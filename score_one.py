#!/usr/bin/env python3
"""
score_one.py
============
Score a SINGLE new candidate against the SPDR pipeline without re-processing
the full 100,000-row dataset. Useful when a new candidate/employee profile
needs to be checked on its own (e.g. a fresh applicant, or testing how a
hypothetical profile would rank).

This does NOT duplicate any scoring logic -- it imports and calls the exact
same functions rank.py uses (ingest.parse_candidate, spdr_engine, scoring,
explain), so a score produced here is guaranteed consistent with a full
rank.py run. It just skips streaming the other 99,999 candidates.

USAGE
-----
1) From a JSON file matching candidate_schema.json:

    python score_one.py --candidate_json path/to/new_candidate.json

2) From a JSON string directly:

    python score_one.py --candidate_json '{"candidate_id": "CAND_NEW001", ...}'

3) Interactively, with a minimal set of prompts (skills/title/years only --
   fills in sensible defaults for fields you don't have yet, e.g. while
   screening a fresh applicant before their full platform profile exists):

    python score_one.py --quick

Output: current fit, 3/6/12-month projected future fit, composite score,
eligibility gate result, and the same reasoning text used in the CSV.
"""
from __future__ import annotations
import argparse
import json
import sys

import numpy as np

from src.ingest import parse_candidate
from src.taxonomy import AXES
from src.scoring import (
    eligibility_gate, availability_multiplier, location_modifier,
    W_CURRENT, W_FUTURE,
)
from src.spdr_engine import (
    estimate_candidate_drift_volatility, run_spdr_for_population,
)
from src.explain import build_reasoning
from src.calibrate_priors import N_AXES  # noqa: F401 (sanity import, confirms env is wired)


def load_priors(path="data/priors.json"):
    try:
        with open(path) as f:
            d = json.load(f)
        return np.array(d["mu0"]), np.array(d["sigma0"])
    except FileNotFoundError:
        from src.spdr_engine import DEFAULT_MU0, DEFAULT_SIGMA0
        return DEFAULT_MU0, DEFAULT_SIGMA0


def build_quick_candidate(candidate_id: str) -> dict:
    """Interactive minimal-input builder for a candidate who doesn't have a
    full platform profile yet -- e.g. screening a fresh resume. Anything not
    asked defaults to a neutral/empty value so the pipeline still runs."""
    print("\n--- Quick candidate entry (press Enter to skip optional fields) ---")
    name = input("Name: ").strip() or "Unnamed Candidate"
    title = input("Current title: ").strip() or "Unknown"
    company = input("Current company: ").strip() or "Unknown"
    years = float(input("Years of experience: ").strip() or "0")
    location = input("Location (e.g. 'Pune, Maharashtra'): ").strip() or "Unknown"
    country = input("Country [India]: ").strip() or "India"
    summary = input("Short summary/bio: ").strip() or ""

    print("\nEnter skills one at a time as: name,proficiency,endorsements,duration_months")
    print("  proficiency in {beginner, intermediate, advanced, expert}. Blank line to finish.")
    skills = []
    while True:
        line = input("  skill> ").strip()
        if not line:
            break
        parts = [p.strip() for p in line.split(",")]
        name_s = parts[0]
        prof = parts[1] if len(parts) > 1 and parts[1] else "intermediate"
        endorse = int(parts[2]) if len(parts) > 2 and parts[2] else 0
        dur = int(parts[3]) if len(parts) > 3 and parts[3] else 0
        skills.append({"name": name_s, "proficiency": prof, "endorsements": endorse, "duration_months": dur})

    print("\nEnter past roles one at a time as: title,company,start_date(YYYY-MM-DD),duration_months,description")
    print("  Oldest role first. Blank line to finish.")
    career_history = []
    while True:
        line = input("  role> ").strip()
        if not line:
            break
        parts = [p.strip() for p in line.split(",", 4)]
        career_history.append({
            "title": parts[0] if len(parts) > 0 else "Unknown",
            "company": parts[1] if len(parts) > 1 else "Unknown",
            "start_date": parts[2] if len(parts) > 2 else "2020-01-01",
            "duration_months": int(parts[3]) if len(parts) > 3 and parts[3] else 12,
            "description": parts[4] if len(parts) > 4 else "",
        })

    notice = input("Notice period in days [30]: ").strip() or "30"
    open_to_work = (input("Open to work flag? [y/N]: ").strip().lower() == "y")
    willing_reloc = (input("Willing to relocate? [y/N]: ").strip().lower() == "y")
    last_active = input("Last active date (YYYY-MM-DD) [today]: ").strip() or "2026-06-24"

    return {
        "candidate_id": candidate_id,
        "profile": {
            "anonymized_name": name, "headline": title, "summary": summary,
            "location": location, "country": country, "years_of_experience": years,
            "current_title": title, "current_company": company,
            "current_company_size": "unknown", "current_industry": "unknown",
        },
        "skills": skills,
        "career_history": career_history,
        "education": [],
        "redrob_signals": {
            "last_active_date": last_active,
            "recruiter_response_rate": 0.5,
            "open_to_work_flag": open_to_work,
            "willing_to_relocate": willing_reloc,
            "notice_period_days": int(notice),
            "interview_completion_rate": 0.7,
            "github_activity_score": -1,
            "offer_acceptance_rate": -1,
            "skill_assessment_scores": {},
            "preferred_work_mode": "hybrid",
        },
    }


def score_single_candidate(raw: dict, mu0, sigma0) -> dict:
    rec = parse_candidate(raw)

    states0 = np.array([[rec.current_state[a] for a in AXES]])
    mu, sigma = estimate_candidate_drift_volatility(rec.career_states, rec.career_durations_months, mu0, sigma0)
    mus = mu[None, :]
    sigmas = sigma[None, :]

    spdr_results = run_spdr_for_population(states0, mus, sigmas)
    current_fit = float(spdr_results["0m"]["fit"][0])
    fit_3m = float(spdr_results["3m"]["fit"][0])
    fit_6m = float(spdr_results["6m"]["fit"][0])
    fit_12m = float(spdr_results["12m"]["fit"][0])
    future_state_6m = spdr_results["6m"]["state"][0]
    future_std_6m = spdr_results["6m"]["std"][0]

    eligible, gate_reasons = eligibility_gate(rec)
    avail_mult, avail_notes = availability_multiplier(rec)
    loc_mult, loc_note = location_modifier(rec)

    base_fit = W_CURRENT * current_fit + W_FUTURE * fit_6m
    composite = float(eligible) * avail_mult * loc_mult * base_fit

    reasoning = build_reasoning(
        rec, current_fit, fit_6m, composite, avail_mult, avail_notes, loc_note, rec.plausibility_flags,
    )

    return {
        "candidate_id": rec.candidate_id,
        "name": rec.name,
        "title": rec.current_title,
        "company": rec.current_company,
        "location": rec.location,
        "eligible": eligible,
        "gate_reasons": gate_reasons,
        "current_fit": round(current_fit, 4),
        "future_fit_3m": round(fit_3m, 4),
        "future_fit_6m": round(fit_6m, 4),
        "future_fit_12m": round(fit_12m, 4),
        "composite_score": round(composite, 4),
        "avail_mult": round(avail_mult, 3),
        "avail_notes": avail_notes,
        "loc_mult": round(loc_mult, 3),
        "loc_note": loc_note,
        "current_state": {a: round(rec.current_state[a], 3) for a in AXES},
        "projected_state_6m": {a: round(float(future_state_6m[AXES.index(a)]), 3) for a in AXES},
        "plausibility_score": rec.plausibility_score,
        "plausibility_flags": rec.plausibility_flags,
        "reasoning": reasoning,
    }


def main():
    ap = argparse.ArgumentParser(description="Score a single new candidate against SPDR.")
    ap.add_argument("--candidate_json", help="Path to a JSON file, or a raw JSON string, matching candidate_schema.json")
    ap.add_argument("--quick", action="store_true", help="Interactive minimal-input mode")
    ap.add_argument("--priors", default="data/priors.json")
    ap.add_argument("--out", default=None, help="Optional path to also save the result as JSON")
    args = ap.parse_args()

    mu0, sigma0 = load_priors(args.priors)

    if args.quick:
        raw = build_quick_candidate("CAND_NEW_" + str(abs(hash(input("Give this candidate a short ID/tag: ").strip())) % 100000))
    elif args.candidate_json:
        text = args.candidate_json
        try:
            with open(text) as f:
                raw = json.load(f)
        except (FileNotFoundError, OSError):
            raw = json.loads(text)
    else:
        print("Provide --candidate_json <file_or_json> or --quick", file=sys.stderr)
        sys.exit(1)

    result = score_single_candidate(raw, mu0, sigma0)

    print("\n" + "=" * 64)
    print(f"  {result['name']}  —  {result['title']} @ {result['company']}")
    print("=" * 64)
    print(f"  Eligible:           {'YES' if result['eligible'] else 'NO — ' + '; '.join(result['gate_reasons'])}")
    print(f"  Current fit:        {result['current_fit']}")
    print(f"  Future fit  (3mo):  {result['future_fit_3m']}")
    print(f"  Future fit  (6mo):  {result['future_fit_6m']}")
    print(f"  Future fit (12mo):  {result['future_fit_12m']}")
    print(f"  Availability mult:  x{result['avail_mult']}  {result['avail_notes']}")
    print(f"  Location mult:      x{result['loc_mult']}  ({result['loc_note']})")
    print(f"  >>> COMPOSITE SCORE: {result['composite_score']}")
    if result["plausibility_flags"]:
        print(f"  ⚠ Plausibility flags: {result['plausibility_flags']}")
    print("\n  Reasoning:")
    print(f"  {result['reasoning']}")
    print("=" * 64 + "\n")

    if args.out:
        with open(args.out, "w") as f:
            json.dump(result, f, indent=2)
        print(f"Saved full result to {args.out}")


if __name__ == "__main__":
    main()

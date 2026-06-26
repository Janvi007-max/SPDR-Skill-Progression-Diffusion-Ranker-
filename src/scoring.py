from __future__ import annotations

import math

W_CURRENT = 0.55
W_FUTURE = 0.45


def eligibility_gate(rec) -> tuple[bool, list[str]]:
    reasons = []
    if not rec.raw.get("redrob_signals", {}).get("open_to_work_flag", False):
        reasons.append("not_open_to_work")
    if rec.raw.get("profile", {}).get("years_of_experience", 0) < 2:
        reasons.append("too_junior")
    return not reasons, reasons


def availability_multiplier(rec):
    signals = rec.raw.get("redrob_signals", {})
    notice = int(signals.get("notice_period_days", 30) or 30)
    if notice <= 30:
        return 1.0, "notice_period_favorable"
    if notice <= 60:
        return 0.9, "notice_period_moderate"
    return 0.8, "notice_period_long"


def location_modifier(rec):
    location = str(rec.raw.get("profile", {}).get("location", "")).lower()
    if "pune" in location or "bengaluru" in location or "bangalore" in location:
        return 1.0, "location_favorable"
    return 0.95, "location_standard"

import math
from datetime import datetime

import numpy as np


class CandidateRecord:
    def __init__(self, raw):
        self.raw = raw
        self.candidate_id = raw.get("candidate_id", "")
        self.name = raw.get("profile", {}).get("anonymized_name", "")
        self.current_title = raw.get("profile", {}).get("current_title", "")
        self.current_company = raw.get("profile", {}).get("current_company", "")
        self.location = raw.get("profile", {}).get("location", "")
        self.current_state = {
            "technical_depth": 0.0,
            "leadership": 0.0,
            "domain_expertise": 0.0,
            "communication": 0.0,
            "execution": 0.0,
        }
        self.career_states = []
        self.career_durations_months = []
        self.plausibility_score = 1.0
        self.plausibility_flags = []
        self._parse(raw)

    def _parse(self, raw):
        profile = raw.get("profile", {})
        self.current_state["technical_depth"] = self._skill_score(raw.get("skills", []), "python") * 0.7 + self._skill_score(raw.get("skills", []), "rag") * 0.3
        self.current_state["leadership"] = 0.3 if profile.get("years_of_experience", 0) >= 5 else 0.1
        self.current_state["domain_expertise"] = self._skill_score(raw.get("skills", []), "search") * 0.6 + self._skill_score(raw.get("skills", []), "ranking") * 0.4
        self.current_state["communication"] = 0.5
        self.current_state["execution"] = 0.6

        for role in raw.get("career_history", []):
            duration = int(role.get("duration_months", 0) or 0)
            if duration <= 0:
                continue
            self.career_states.append([self.current_state[a] for a in ["technical_depth", "leadership", "domain_expertise", "communication", "execution"]])
            self.career_durations_months.append(duration)

        if not self.career_states:
            self.career_states = [list(self.current_state.values())]
            self.career_durations_months = [24]

        if raw.get("redrob_signals", {}).get("open_to_work_flag") is False:
            self.plausibility_flags.append("not_open_to_work")

    def _skill_score(self, skills, needle):
        needle = needle.lower()
        total = 0.0
        for skill in skills:
            name = str(skill.get("name", "")).lower()
            if needle in name:
                total += 1.0
        return min(total / 2.0, 1.0)


def parse_candidate(raw):
    return CandidateRecord(raw)

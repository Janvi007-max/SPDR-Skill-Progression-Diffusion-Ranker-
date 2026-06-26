import json
import unittest
from pathlib import Path

import score_one


class ScoreOneImportTests(unittest.TestCase):
    def test_score_single_candidate_runs(self):
        candidate_path = Path(__file__).resolve().parents[1] / "new_candidate.json"
        with candidate_path.open() as fh:
            raw = json.load(fh)

        result = score_one.score_single_candidate(raw, [0.0, 0.0, 0.0, 0.0, 0.0], [1.0, 1.0, 1.0, 1.0, 1.0])

        self.assertEqual(result["candidate_id"], raw["candidate_id"])
        self.assertIn("composite_score", result)
        self.assertIn("reasoning", result)


if __name__ == "__main__":
    unittest.main()

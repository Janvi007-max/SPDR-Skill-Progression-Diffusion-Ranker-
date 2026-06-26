import numpy as np

DEFAULT_MU0 = np.array([0.0, 0.0, 0.0, 0.0, 0.0], dtype=float)
DEFAULT_SIGMA0 = np.array([1.0, 1.0, 1.0, 1.0, 1.0], dtype=float)


def estimate_candidate_drift_volatility(career_states, durations, mu0, sigma0):
    states = np.array(career_states, dtype=float)
    if states.ndim == 1:
        states = states[None, :]
    if len(states) == 0:
        states = np.array([[0.0, 0.0, 0.0, 0.0, 0.0]], dtype=float)
    mu = np.mean(states, axis=0)
    sigma = np.sqrt(np.maximum(np.var(states, axis=0), 0.05))
    return mu, sigma


def run_spdr_for_population(states0, mus, sigmas):
    states0 = np.array(states0, dtype=float)
    mus = np.array(mus, dtype=float)
    sigmas = np.array(sigmas, dtype=float)
    out = {}
    for horizon in ["0m", "3m", "6m", "12m"]:
        fit = np.clip(0.5 + 0.1 * np.mean(states0, axis=1), 0.0, 1.0)
        state = np.clip(states0 + 0.01 * (np.arange(states0.shape[1]) + 1), 0.0, 1.0)
        std = np.ones_like(state) * 0.1
        out[horizon] = {"fit": fit, "state": state, "std": std}
    return out

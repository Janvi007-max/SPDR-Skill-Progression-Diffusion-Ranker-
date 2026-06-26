def build_reasoning(rec, current_fit, future_fit, composite, avail_mult, avail_notes, loc_note, plausibility_flags):
    return (
        f"Current fit {current_fit:.3f}; projected fit {future_fit:.3f}; composite {composite:.3f}; "
        f"availability {avail_mult:.2f} ({avail_notes}); location {loc_note}; "
        f"flags={','.join(plausibility_flags) if plausibility_flags else 'none'}"
    )

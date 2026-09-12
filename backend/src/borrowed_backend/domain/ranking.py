from .models import Garment, SearchRequest


def score(garment: Garment, req: SearchRequest) -> float:
    colour_match = bool(garment.colour_family and req.colour_family and
                        garment.colour_family.casefold() == req.colour_family.casefold())
    hints = {hint.casefold() for hint in req.style_hints}
    tags = {tag.casefold() for tag in garment.style_tags}
    return float(
        3 * colour_match + 2 * (req.occasion in garment.occasion)
        + min(3, len(hints & tags)) + (garment.formality >= 4)
        + (garment.lender_rating >= 4.5) + (garment.delivery_days == 1)
    )

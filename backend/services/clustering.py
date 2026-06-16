"""Cluster enriched items into stories based on keyword similarity."""
from typing import Optional


def similarity(a: list[str], b: list[str]) -> float:
    """Return the similarity between two keyword lists (case insensitive)."""
    if not a or not b:
        return 0.0
    set_a = {w.lower() for w in a}
    set_b = {w.lower() for w in b}
    union = set_a | set_b
    if not union:
        return 0.0
    # jaccard index: shared keywords over total distinct keywords
    return len(set_a & set_b) / len(union)


def _best_cluster(item_keywords: list[str], clusters: list[dict], threshold: float) -> Optional[int]:
    """Return the index of the cluster most similar to the item, or None if none pass the threshold."""
    best_index = None
    best_score = threshold  # a cluster must beat the threshold to be a match
    for i, cluster in enumerate(clusters):
        score = similarity(item_keywords, cluster["keywords"])
        if score >= best_score:
            best_score = score
            best_index = i
    return best_index


def cluster_items(items: list[dict], threshold: float = 0.3) -> list[dict]:
    """Group items into stories by greedy keyword-overlap clustering.

    Each story is a dict with an 'id', a representative 'keywords' list, and the
    list of 'items' that were assigned to it. Items without keywords always form
    their own story.
    """
    clusters: list[dict] = []
    for item in items:
        item_keywords = item.get("keywords", []) or []
        # no keywords means nothing to match on, so the item starts its own story
        match = _best_cluster(item_keywords, clusters, threshold) if item_keywords else None
        if match is None:
            clusters.append({
                "id": f"story-{len(clusters) + 1}",
                "keywords": list(item_keywords),
                "items": [item],
            })
        else:
            clusters[match]["items"].append(item)
            # grow the cluster's keyword set with any new words this item adds
            existing = {w.lower() for w in clusters[match]["keywords"]}
            for word in item_keywords:
                if word.lower() not in existing:
                    clusters[match]["keywords"].append(word)
                    existing.add(word.lower())
    return clusters

"""Unit tests for the story clustering service."""
from backend.services import clustering


def make_item(item_id: str, keywords: list[str], title: str = "") -> dict:
    """build a minimal item dict for use in clustering tests"""
    return {"id": item_id, "keywords": keywords, "title": title or item_id}


class TestSimilarity:
    """Tests for the similarity helper."""

    def test_identical(self) -> None:
        """identical keyword sets give a similarity of 1.0"""
        assert clustering.similarity(["python", "flask"], ["python", "flask"]) == 1.0

    def test_disjoint(self) -> None:
        """No overlap gives a similarity of 0.0."""
        assert clustering.similarity(["python"], ["rust"]) == 0.0

    def test_partial(self) -> None:
        """Partial overlap is strictly between 0 and 1."""
        result = clustering.similarity(["a", "b"], ["b", "c"])
        assert 0.0 < result < 1.0

    def test_empty_inputs(self) -> None:
        """Empty keyword lists give a similarity of 0.0."""
        assert clustering.similarity([], []) == 0.0
        assert clustering.similarity([], ["python"]) == 0.0

    def test_case_insensitive(self) -> None:
        """Matching is case insensitive."""
        assert clustering.similarity(["Python"], ["PYTHON"]) == 1.0


class TestClusterItems:
    """Tests for the top-level cluster_items function."""

    def test_empty_list(self) -> None:
        """No items returns no stories."""
        assert clustering.cluster_items([]) == []

    def test_single_item_is_own_story(self) -> None:
        """A single item produces a single story containing it."""
        items = [make_item("a", ["python", "flask"])]
        stories = clustering.cluster_items(items)
        assert len(stories) == 1
        assert len(stories[0]["items"]) == 1
        assert stories[0]["items"][0]["id"] == "a"

    def test_similar_items_grouped(self) -> None:
        """Items with high keyword overlap end up in the same story."""
        items = [
            make_item("a", ["python", "flask", "web"]),
            make_item("b", ["python", "flask", "api"]),
        ]
        stories = clustering.cluster_items(items, threshold=0.3)
        assert len(stories) == 1
        assert {it["id"] for it in stories[0]["items"]} == {"a", "b"}

    def test_dissimilar_items_separate(self) -> None:
        """Items with no overlap form separate stories"""
        items = [
            make_item("a", ["python", "flask"]),
            make_item("b", ["football", "league"]),
        ]
        stories = clustering.cluster_items(items, threshold=0.3)
        assert len(stories) == 2

    def test_story_has_id_and_keywords(self) -> None:
        """Each story exposes an id and a representative keyword list"""
        items = [make_item("a", ["python"])]
        stories = clustering.cluster_items(items)
        assert "id" in stories[0]
        assert isinstance(stories[0]["id"], str)
        assert "keywords" in stories[0]
        assert "python" in stories[0]["keywords"]

    def test_item_without_keywords_is_own_story(self) -> None:
        """an item with no keywords cannot match anything and forms its own 'story'"""
        items = [
            make_item("a", ["python", "flask"]),
            make_item("b", []),
        ]
        stories = clustering.cluster_items(items, threshold=0.3)
        assert len(stories) == 2

    def test_threshold_controls_grouping(self) -> None:
        """A higher threshold makes grouping stricter."""
        items = [
            make_item("a", ["python", "flask", "web"]),
            make_item("b", ["python", "django", "api"]),
        ]
        loose = clustering.cluster_items(items, threshold=0.1)
        strict = clustering.cluster_items(items, threshold=0.9)
        assert len(loose) == 1
        assert len(strict) == 2

    def test_story_ids_unique(self) -> None:
        """Distinct stories get distinct ids, even if they have the same keywords."""
        items = [
            make_item("a", ["python"]),
            make_item("b", ["football"]),
            make_item("c", ["cooking"]),
        ]
        stories = clustering.cluster_items(items)
        ids = [s["id"] for s in stories]
        assert len(ids) == len(set(ids))

    def test_all_items_preserved(self) -> None:
        """every input item appears in exactly 1 story"""
        items = [
            make_item("a", ["python", "flask"]),
            make_item("b", ["python", "flask"]),
            make_item("c", ["football"]),
        ]
        stories = clustering.cluster_items(items, threshold=0.3)
        grouped_ids = [it["id"] for s in stories for it in s["items"]]
        assert sorted(grouped_ids) == ["a", "b", "c"]

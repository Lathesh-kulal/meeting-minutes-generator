from ml_training.eval_action_items import gold_groups, score


def test_consecutive_gold_lines_are_one_action():
    meeting = [("a", False), ("Let's follow up.", True), ("I'll email them.", True), ("b", False), ("Do X.", True)]
    assert gold_groups(meeting) == [("Let's follow up.", "I'll email them."), ("Do X.",)]


def test_group_found_if_any_line_covered_and_false_alarm_counted():
    groups = [("req", "accept"), ("other",)]
    items = [{"accept"}, {"noise"}]
    good, bad, found, missed = score(items, groups)
    assert len(good) == 1 and len(bad) == 1
    assert found == [("req", "accept")] and missed == [("other",)]

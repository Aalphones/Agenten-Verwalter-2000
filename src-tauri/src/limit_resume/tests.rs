use super::is_limit_stop;

const RESET_AT: i64 = 1_762_900_000;

#[test]
fn session_limit_text_is_a_limit_stop() {
    assert!(is_limit_stop(
        "You've hit your session limit · resets 2:10pm (Europe/Berlin)",
        None
    ));
}

#[test]
fn usage_limit_reached_text_is_a_limit_stop() {
    assert!(is_limit_stop(
        "Claude AI usage limit reached|1762900000",
        None
    ));
}

#[test]
fn rejected_event_is_a_limit_stop_whatever_the_text() {
    assert!(is_limit_stop("irgendwas", Some(RESET_AT)));
}

#[test]
fn other_errors_are_no_limit_stop() {
    assert!(!is_limit_stop("API Error: 500", None));
}

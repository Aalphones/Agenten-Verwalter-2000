use super::{
    LimitResumes, MAX_ATTEMPTS, RESUME_BUFFER_MS, RESUME_FALLBACK_MS, is_limit_stop, resume_at_ms,
};

const RESET_AT: i64 = 1_762_900_000;
const SESSION: &str = "session-1";

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

#[test]
fn future_reset_resumes_after_the_buffer() {
    let now: f64 = (RESET_AT - 600) as f64 * 1000.0;
    assert_eq!(
        resume_at_ms(Some(RESET_AT), now),
        RESET_AT as f64 * 1000.0 + RESUME_BUFFER_MS
    );
}

#[test]
fn past_reset_falls_back_from_now() {
    let now: f64 = (RESET_AT + 60) as f64 * 1000.0;
    assert_eq!(resume_at_ms(Some(RESET_AT), now), now + RESUME_FALLBACK_MS);
}

#[test]
fn unknown_reset_falls_back_from_now() {
    let now: f64 = RESET_AT as f64 * 1000.0;
    assert_eq!(resume_at_ms(None, now), now + RESUME_FALLBACK_MS);
}

#[test]
fn begin_replaces_the_old_token() {
    let mut resumes = LimitResumes::default();
    let old: u64 = resumes.begin(SESSION, 1000.0);
    let new: u64 = resumes.begin(SESSION, 2000.0);
    assert!(!resumes.take(SESSION, old));
    assert_eq!(resumes.ends().get(SESSION), Some(&2000.0));
    assert!(resumes.take(SESSION, new));
    assert!(!resumes.take(SESSION, new));
}

#[test]
fn cancel_ends_all_waiting() {
    let mut resumes = LimitResumes::default();
    resumes.begin(SESSION, 1000.0);
    assert!(resumes.any_waiting());
    assert!(resumes.cancel(SESSION));
    assert!(!resumes.any_waiting());
    assert!(!resumes.cancel(SESSION));
}

#[test]
fn attempts_count_up_to_the_limit_and_reset() {
    let mut resumes = LimitResumes::default();
    for _ in 0..MAX_ATTEMPTS {
        resumes.begin(SESSION, 1000.0);
    }
    assert_eq!(resumes.attempts(SESSION), MAX_ATTEMPTS);
    resumes.cancel(SESSION);
    assert_eq!(resumes.attempts(SESSION), MAX_ATTEMPTS);
    resumes.reset_attempts(SESSION);
    assert_eq!(resumes.attempts(SESSION), 0);
}

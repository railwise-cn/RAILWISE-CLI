pub fn init() -> Option<sentry::ClientInitGuard> {
    let dsn = std::env::var("RAILWISE_SENTRY_DSN")
        .ok()
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())?;

    Some(sentry::init((
        dsn,
        sentry::ClientOptions {
            release: sentry::release_name!(),
            traces_sample_rate: 0.1,
            ..Default::default()
        },
    )))
}

// Fired (on window) when the live connection comes back after a drop, the network returns,
// or the tab is shown again after a while — anything broadcast meanwhile was missed, so
// pages showing live data reload it. (Own file so NotificationContext and liveRefresh
// don't import each other.)
export const LIVE_RESYNC_EVENT = "qm:live-resync";

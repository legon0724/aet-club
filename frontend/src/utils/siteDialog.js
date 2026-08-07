const listeners = new Set();

function requestDialog(options) {
  return new Promise((resolve) => {
    const payload = { ...options, resolve };
    listeners.forEach((listener) => listener(payload));
  });
}

export function subscribeToSiteDialog(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function showSiteAlert(message, title = '알림') {
  return requestDialog({ type: 'alert', title, message });
}

export function showSiteConfirm(message, title = '확인') {
  return requestDialog({ type: 'confirm', title, message });
}

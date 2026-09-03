// Coordinació mínima: engegar o aturar tots dos sistemes alhora.
// Si el Tuya encara no està configurat (falta TUYA_DEVICE_ID a .env), s'ignora
// sense trencar la petició, perquè puguis fer servir només el ViCare de moment.
const vicare = require('./vicareClient');
const tuya = require('./tuyaClient');

function tuyaConfigured() {
  return Boolean(process.env.TUYA_DEVICE_ID && process.env.TUYA_ACCESS_ID);
}

async function startAll() {
  const result = { vicare: null, tuya: null };
  result.vicare = await vicare.start();

  if (tuyaConfigured()) {
    try {
      result.tuya = await tuya.start();
    } catch (err) {
      result.tuya = { error: err.message };
    }
  } else {
    result.tuya = { skipped: 'Tuya encara no configurat' };
  }

  return result;
}

async function stopAll() {
  const result = { vicare: null, tuya: null };
  result.vicare = await vicare.stop();

  if (tuyaConfigured()) {
    try {
      result.tuya = await tuya.stop();
    } catch (err) {
      result.tuya = { error: err.message };
    }
  } else {
    result.tuya = { skipped: 'Tuya encara no configurat' };
  }

  return result;
}

// Programa una acció del Tuya ('start' o 'stop') un temps després (per defecte
// 10 minuts). És un setTimeout dins del procés Node: si el servidor es reinicia
// abans que passi el temps, la programació es perd. Només hi ha una programació
// pendent alhora: engegar-ne una de nova cancel·la l'anterior (evita xocs).
let pendingTuyaAction = null;

function scheduleTuyaAction(action, delayMinutes = Number(process.env.TUYA_START_DELAY_MINUTES) || 10) {
  if (!tuyaConfigured()) {
    return { scheduled: false, reason: 'Tuya encara no configurat' };
  }

  if (pendingTuyaAction) clearTimeout(pendingTuyaAction);

  const delayMs = delayMinutes * 60 * 1000;
  pendingTuyaAction = setTimeout(async () => {
    pendingTuyaAction = null;
    try {
      if (action === 'start') await tuya.start();
      else await tuya.stop();
      console.log(`[coordinator] Fancoil ${action === 'start' ? 'engegat' : 'aturat'} automàticament (${delayMinutes} min després del ViCare)`);
    } catch (err) {
      console.error(`[coordinator] Error ${action === 'start' ? 'engegant' : 'aturant'} el fancoil programat:`, err.message);
    }
  }, delayMs);

  return { scheduled: true, action, delayMinutes };
}

function scheduleTuyaStart(delayMinutes) {
  return scheduleTuyaAction('start', delayMinutes);
}

function scheduleTuyaStop(delayMinutes) {
  return scheduleTuyaAction('stop', delayMinutes);
}

function cancelScheduledTuyaAction() {
  if (pendingTuyaAction) {
    clearTimeout(pendingTuyaAction);
    pendingTuyaAction = null;
    return { cancelled: true };
  }
  return { cancelled: false };
}

module.exports = {
  startAll,
  stopAll,
  tuyaConfigured,
  scheduleTuyaStart,
  scheduleTuyaStop,
  cancelScheduledTuyaAction,
};

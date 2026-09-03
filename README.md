# ViCare + Fancoil (FT4W) — Engegar/Aturar

App mínima que engega i atura la bomba de calor Viessmann (**ViCare**) i, quan el tinguis
connectat, el cronotermostat de fancoil (**Tuya**, tipus FERCO FT4W) — des d'un únic panell.

## Estructura
```
server/
  index.js          → servidor Express + rutes API
  vicareClient.js    → OAuth2 (PKCE) i start()/stop() sobre l'API ViCare
  tuyaClient.js       → signatura de peticions i start()/stop() sobre la Tuya Cloud API
  coordinator.js      → engegar/aturar tots dos sistemes alhora
public/
  index.html          → panell amb botons Engegar / Aturar
```

## Configuració pas a pas

### 1. Viessmann ViCare
1. Registra't a https://developer.viessmann.com i crea una aplicació.
2. Com a **Redirect URI** posa `http://localhost:3000/auth/vicare/callback`.
3. Copia el `client_id` a `.env`.
4. Un cop connectat (botó "Connectar ViCare"), consulta `/api/vicare/status` i
   busca la feature `heating.circuits.X.operating.modes.active`. El camp
   `commands.setMode.params.mode.constraints.enum` et dirà els valors vàlids
   de mode (ex: `standby`, `dhwAndHeating`...). Ajusta `VICARE_MODE_ON` /
   `VICARE_MODE_OFF` a `.env` amb els valors correctes per al teu model.

### 2. Tuya Cloud (per al FT4W un cop el tinguis)
1. Vincula primer el dispositiu amb l'app **Smart Life** o **Tuya Smart** del mòbil.
2. Crea un compte a https://iot.tuya.com i un projecte "Cloud Development" (Trial gratuïta).
3. A "Devices" vincula el compte de Smart Life amb el projecte → apareixerà el `device_id`.
4. A "Debug Device" comprova el `code` exacte per engegar/aturar (normalment `switch`)
   i posa'l a `TUYA_POWER_CODE` si és diferent.
5. Copia `Access ID`, `Access Secret` i `device_id` a `.env`.

Mentre no omplis `TUYA_ACCESS_ID` / `TUYA_DEVICE_ID`, els botons del Tuya fallaran
i el botó "Engegar/Aturar tot" simplement ignora el Tuya (no trenca res).

### 3. Instal·lació i arrencada
```bash
cp .env.example .env      # i omple els valors
npm install
npm start
```
Obre http://localhost:3000, prem "Connectar ViCare" (només el primer cop) i ja
pots engegar/aturar amb els botons.

## Notes importants
- S'ha simplificat expressament: sense setpoints de temperatura ni velocitats de
  ventilador, sense sincronització automàtica — només ON/OFF per a cada sistema
  i un botó combinat.
- Els valors exactes (`VICARE_MODE_ON/OFF`, `TUYA_POWER_CODE`) **cal confirmar-los**
  contra el teu equip real, tal com s'indica a dalt.

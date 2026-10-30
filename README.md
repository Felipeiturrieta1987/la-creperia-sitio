# La Crepería & Co · Carta digital

Sitio web de la carta con panel de administración.

- **Carta pública** (`/`): buscador, filtros, fotos, armador "Arma tu Bowl" y código QR.
- **Panel** (`/admin`): entras con contraseña y desde ahí puedes:
  - editar productos, precios, categorías y datos del local;
  - marcar productos como agotados;
  - subir fotos o crear y mejorar fotos con IA;
  - ver el historial de versiones y restaurar una anterior;
  - descargar el código QR.
- Los datos y las fotos se guardan en una base de datos SQLite dentro del servidor.

---

## Publicarlo en Railway (unos 10 minutos)

### 1. Sube el proyecto

Elige **una** de estas dos opciones.

**Opción A, con GitHub (recomendada):**

1. Crea un repositorio nuevo en github.com (puede ser privado).
2. Toca **"uploading an existing file"** y arrastra **todo el contenido** de esta carpeta.
   - No subas la carpeta `node_modules` si existe.
3. Confirma con **Commit changes**.
4. En railway.app ve a **New Project → Deploy from GitHub repo** y elige ese repositorio.

**Opción B, con la terminal (Railway CLI):**

```bash
npm i -g @railway/cli
railway login
railway init        # crea el proyecto
railway up          # sube esta carpeta
```

Railway detecta el `Dockerfile` y construye el sitio solo.

### 2. Agrega un volumen (obligatorio para no perder cambios)

1. En el proyecto, haz clic derecho sobre el servicio y elige **Attach Volume**. También puedes usar `Ctrl/⌘ + K` y escribir "Volume".
2. Mount path: **`/data`**

Sin volumen, cada redeploy borra los cambios que hiciste en el panel.

### 3. Variables (pestaña **Variables** del servicio)

| Variable | Obligatoria | Para qué sirve |
|---|---|---|
| `ADMIN_PASSWORD` | Sí | La contraseña del panel `/admin`. Usa una larga. |
| `OPENAI_API_KEY` | No | Activa los botones de fotos con IA. |
| `SITE_URL` | No | Tu dominio final, por ejemplo `https://carta.lacreperia.cl`. Se usa para el QR. |
| `OPENAI_IMAGE_QUALITY` | No | `low`, `medium` (por defecto) o `high`. A más calidad, más costo. |
| `OPENAI_IMAGE_MODEL` | No | Modelo de imágenes. Por defecto `gpt-image-1`. |

### 4. Dominio

En **Settings → Networking**:

- toca **Generate Domain** para obtener un enlace `*.up.railway.app`; o
- toca **Custom Domain** para usar tu propio dominio.

Listo. Entra a `https://TU-DOMINIO/admin` con tu contraseña.

---

## Fotos con IA (ChatGPT / OpenAI)

El panel tiene una pestaña **"Fotos con IA"** con tres botones:

- **Mejorar con IA:** toma la foto actual como referencia y crea una versión nítida, con luz natural y sin brillos de la carta impresa.
- **Crear foto con IA:** genera una foto para un producto que no tiene, a partir del nombre y la descripción.
- **Mejorar todas las fotos:** procesa todas las fotos una por una.

Puedes escribir indicaciones en el campo **"Indicaciones para la IA"** de cada producto, por ejemplo "vista desde arriba" o "en plato blanco". Si no te gusta el resultado, toca **"Volver a la foto anterior"**. Nada se publica hasta que tocas **Publicar cambios**.

### Cómo obtener la API key

1. Entra a **platform.openai.com** con tu cuenta (es la misma cuenta de ChatGPT).
2. Ve a **Settings → Billing** y carga saldo. La API se cobra aparte de ChatGPT Plus, por imagen generada.
3. Ve a **API keys → Create new secret key** y copia la clave (empieza con `sk-`).
4. En Railway, agrégala como variable `OPENAI_API_KEY`. El servicio se reinicia solo.

Algunas cuentas nuevas deben verificar su organización para usar el modelo de imágenes. Se hace en **Settings → Organization → Verify**. El panel te avisa si es el caso.

¿Prefieres no usar la API? Pídele a ChatGPT que mejore la foto, descárgala y súbela con el botón **Cambiar foto**.

---

## Probarlo en tu computador

Requiere Node.js 22.13 o superior.

```bash
npm install
npm run dev          # contraseña del panel: demo
```

Abre http://localhost:3000 (carta) y http://localhost:3000/admin (panel).

## Respaldo

Toda la información está en `/data/carta.sqlite`, dentro del volumen de Railway. El panel guarda las últimas 60 versiones publicadas.

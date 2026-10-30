# La Crepería & Co · Carta digital

Sitio web de la carta con panel de administración.

**Carta pública (`/`):**

- buscador y filtros;
- fotos de los productos;
- armador "Arma tu Bowl".

**Panel (`/admin`), con contraseña:**

- editar productos, precios, categorías y datos del local;
- marcar productos como agotados;
- subir fotos o mejorarlas con IA;
- historial de versiones;
- código QR para las mesas.

El proyecto funciona de dos formas: **gratis en Cloudflare** (recomendada) o en un servidor Node como Railway o Render.

---

## Opción gratis: Cloudflare Pages + D1

No necesitas tarjeta. El plan gratis permite 100.000 visitas al día, el sitio no se apaga y carga rápido desde Chile.

### 1. Crea la cuenta y la base de datos

1. Crea una cuenta gratis en **dash.cloudflare.com/sign-up**.
2. En el menú izquierdo entra a **Storage & Databases → D1 SQL Database**.
3. Toca **Create**, ponle de nombre **carta** y toca **Create**.

### 2. Conecta el repositorio de GitHub

1. En el menú entra a **Workers & Pages → Create** y elige la pestaña **Pages**. Si solo ves Workers, toca el enlace "Looking to deploy Pages? Get started".
2. Toca **Import an existing Git repository**, autoriza GitHub y elige `la-creperia-sitio`.
3. En la configuración:
   - Project name: `la-creperia`, que queda como `la-creperia.pages.dev`.
   - Framework preset: **None**.
   - Build command: déjalo **vacío**.
   - Build output directory: **`public`**.
4. Abre **Environment variables** y agrega `ADMIN_PASSWORD` con tu contraseña.
5. Toca **Save and Deploy**.

### 3. Conecta la base de datos al sitio

1. En el proyecto, ve a **Settings → Bindings → Add → D1 database**.
2. En Variable name escribe **`DB`** y en la base de datos elige **carta**. Guarda.
3. Ve a **Deployments**, abre el menú `···` del último deploy y toca **Retry deployment**. Así se aplica la conexión.

### 4. Listo

- Carta: `https://la-creperia.pages.dev`
- Panel: `https://la-creperia.pages.dev/admin`

Si al abrir la carta ves "Casi listo", falta el paso 3: la conexión `DB` o el redeploy.

**Fotos con IA:** en **Settings → Variables and Secrets** agrega `OPENAI_API_KEY` como Secret y vuelve a hacer **Retry deployment**.

**Dominio propio:** ve a **Custom domains → Set up a custom domain**.

**Actualizar el sitio:** cada vez que subes archivos nuevos al repositorio de GitHub, Cloudflare publica la nueva versión solo. Lo que editas en el panel queda en la base de datos y no se pierde.

---

## Fotos con IA (ChatGPT / OpenAI)

El panel tiene una pestaña **"Fotos con IA"** con tres botones:

- **Mejorar con IA:** crea una versión nítida y profesional del mismo plato a partir de la foto actual.
- **Crear foto con IA:** genera una foto para un producto que no tiene, usando el nombre y la descripción.
- **Mejorar todas las fotos:** procesa todas las fotos una por una.

Puedes dar indicaciones para la IA ("vista desde arriba", "en plato blanco") y volver a la foto anterior si no te gusta. Nada se publica hasta que tocas **Publicar cambios**.

### Cómo obtener la API key

1. Entra a **platform.openai.com** con tu cuenta de OpenAI.
2. Ve a **Settings → Billing** y carga saldo. La API se cobra aparte de ChatGPT Plus, por imagen.
3. Ve a **API keys → Create new secret key** y copia la clave, que empieza con `sk-`.

Algunas cuentas nuevas deben verificar su organización (**Settings → Organization**). Si es tu caso, el panel te avisa.

---

## Otras opciones de hosting (de pago)

- **Render:** **New → Blueprint** con el `render.yaml` incluido, plan Starter con disco.
- **Railway:** despliega el repositorio, agrega un Volume en `/data` y la variable `ADMIN_PASSWORD`.

Ambas usan `server.js` (Node 22+ con SQLite) y el `Dockerfile`.

## Probarlo en tu computador

```bash
npm install
npm run dev          # http://localhost:3000  ·  panel: /admin  ·  contraseña: demo
```

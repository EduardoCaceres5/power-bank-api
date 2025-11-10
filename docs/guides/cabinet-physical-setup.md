# Guía de Configuración del Gabinete Físico PM8

Esta guía explica cómo configurar el gabinete físico PM8 para que se conecte a WsCharge y aparezca como ONLINE en el sistema.

## 📋 Tabla de Contenidos

1. [Requisitos Previos](#requisitos-previos)
2. [Configuración de Red](#configuración-de-red)
3. [Configuración del Servidor WsCharge](#configuración-del-servidor-wscharge)
4. [Verificación de Conexión](#verificación-de-conexión)
5. [Troubleshooting](#troubleshooting)

---

## 🎯 Requisitos Previos

Antes de configurar el gabinete físico, asegúrate de tener:

- ✅ Gabinete PM8 encendido y funcionando
- ✅ Acceso físico al gabinete (para configurar red)
- ✅ Conexión a internet (WiFi o 4G)
- ✅ El gabinete registrado en WsCharge API
- ✅ Credenciales de acceso al panel de configuración del gabinete

---

## 🌐 Configuración de Red

### Opción 1: Conexión WiFi

1. **Accede al menú de configuración del gabinete**
   - Generalmente hay un botón de configuración o un menú en la pantalla
   - O usa la aplicación móvil del fabricante si está disponible

2. **Configura la conexión WiFi**
   - Ve a **Configuración → Red → WiFi**
   - Selecciona tu red WiFi
   - Ingresa la contraseña
   - Guarda la configuración

3. **Verifica la conexión**
   - El gabinete debería mostrar un ícono de WiFi conectado
   - Verifica que tenga una IP asignada

### Opción 2: Conexión Ethernet

1. **Conecta el cable Ethernet**
   - Conecta un cable Ethernet desde el router al gabinete
   - El gabinete debería obtener IP automáticamente (DHCP)

2. **Verifica la conexión**
   - El gabinete debería mostrar conexión activa
   - Verifica que tenga una IP asignada

### Opción 3: Conexión 4G (si está disponible)

1. **Inserta la tarjeta SIM**
   - Asegúrate de que la tarjeta SIM tenga datos activos
   - Inserta la tarjeta en el slot correspondiente del gabinete

2. **Configura la conexión 4G**
   - Ve a **Configuración → Red → 4G**
   - El gabinete debería conectarse automáticamente
   - Verifica que tenga señal (barras de señal)

---

## ⚙️ Configuración del Servidor WsCharge

El gabinete PM8 necesita estar configurado para conectarse al servidor de WsCharge. Esta es la parte más importante para que aparezca como ONLINE.

### Información del Servidor

El gabinete debe conectarse a:

- **Servidor:** `api.w-dian.cn`
- **Protocolo:** WebSocket (WSS)
- **Puerto:** 443 (HTTPS/WSS) o el puerto configurado por el fabricante
- **Frecuencia de Heartbeat:** ~45 segundos

### Pasos de Configuración

1. **Accede al menú de configuración del servidor**
   - Ve a **Configuración → Servidor** o **Configuración → Cloud**
   - Busca opciones como "Server URL", "Cloud Server", "API Server"

2. **Configura la URL del servidor**
   - **URL del Servidor:** `wss://api.w-dian.cn` o `https://api.w-dian.cn`
   - O usa la IP si el fabricante lo requiere
   - **Puerto:** Generalmente 443 (por defecto para WSS)

3. **Configura el OCODE (si es necesario)**
   - El OCODE es tu identificador de operador
   - En tu caso: `samuelcharge`
   - Ingresa este valor en el campo correspondiente

4. **Configura el Cabinet ID**
   - Asegúrate de que el Cabinet ID del gabinete físico coincida con el registrado
   - Tu Cabinet ID: `GT042250704279`
   - Este ID debe coincidir exactamente

5. **Guarda la configuración**
   - Guarda todos los cambios
   - El gabinete debería reiniciarse o reconectarse automáticamente

### Configuración Avanzada (si está disponible)

Algunos gabinetes tienen opciones avanzadas:

- **Intervalo de Heartbeat:** Configura a 45 segundos (o el valor recomendado)
- **Timeout de Conexión:** Generalmente 30-60 segundos
- **Reintentos:** 3-5 intentos
- **SSL/TLS:** Asegúrate de que esté habilitado para conexiones seguras

---

## ✅ Verificación de Conexión

### 1. Verificar en el Gabinete Físico

Después de configurar, verifica en la pantalla del gabinete:

- ✅ Ícono de conexión activa (WiFi/4G/Ethernet)
- ✅ Mensaje de "Conectado" o "Online"
- ✅ Sin mensajes de error de conexión

### 2. Verificar en WsCharge API

Ejecuta el script de diagnóstico:

```bash
pnpm run diagnose:cabinet
```

Deberías ver:

- ✅ El gabinete aparece en WsCharge
- ✅ Estado: `🟢 ONLINE`
- ✅ Último heartbeat reciente (hace menos de 2 minutos)

### 3. Verificar en tu Base de Datos

Ejecuta el script de sincronización:

```bash
pnpm run sync:cabinets
```

Luego verifica:

```bash
pnpm run diagnose:cabinet
```

Deberías ver:

- ✅ Estado sincronizado: `🟢 ONLINE`
- ✅ `lastPingAt` actualizado recientemente

---

## 🔧 Troubleshooting

### El gabinete no se conecta a internet

**Síntomas:**

- No hay ícono de conexión
- Mensaje de "Sin conexión"

**Soluciones:**

1. Verifica que el router/WiFi esté funcionando
2. Verifica la contraseña de WiFi
3. Verifica que el cable Ethernet esté bien conectado
4. Reinicia el gabinete
5. Verifica la configuración de red del gabinete

### El gabinete está conectado a internet pero no aparece ONLINE

**Síntomas:**

- Tiene conexión a internet
- Pero `is_online = 0` en WsCharge

**Soluciones:**

1. **Verifica la URL del servidor**
   - Debe ser exactamente: `wss://api.w-dian.cn` o `https://api.w-dian.cn`
   - Sin espacios ni caracteres extra

2. **Verifica el OCODE**
   - Debe ser: `samuelcharge`
   - Case-sensitive (minúsculas)

3. **Verifica el Cabinet ID**
   - Debe coincidir exactamente: `GT042250704279`
   - Sin espacios ni caracteres extra

4. **Reinicia el gabinete**
   - Apaga y enciende el gabinete
   - Espera 2-3 minutos para que se reconecte

5. **Verifica el firewall**
   - Asegúrate de que el puerto 443 (WSS) no esté bloqueado
   - Verifica que no haya firewall bloqueando la conexión

### El gabinete se conecta pero se desconecta frecuentemente

**Síntomas:**

- Aparece ONLINE pero luego OFFLINE
- Conexión intermitente

**Soluciones:**

1. **Verifica la señal WiFi**
   - Asegúrate de que la señal sea fuerte (más de 3 barras)
   - Mueve el gabinete más cerca del router si es necesario

2. **Verifica la estabilidad de la conexión**
   - Prueba con cable Ethernet si es posible
   - Verifica que no haya interferencias

3. **Verifica la configuración de heartbeat**
   - Asegúrate de que el intervalo sea 45 segundos
   - No debe ser muy largo (más de 5 minutos)

### El gabinete no está registrado en WsCharge

**Síntomas:**

- No aparece en la lista de gabinetes de WsCharge

**Soluciones:**

1. **Registra el gabinete manualmente**

   ```bash
   pnpm run setup:cabinet
   ```

2. **O usa la API directamente**
   - Usa el endpoint de agregar gabinete
   - Asegúrate de usar el Cabinet ID correcto

### No puedo acceder al menú de configuración

**Síntomas:**

- No encuentro cómo acceder a la configuración

**Soluciones:**

1. **Consulta el manual del fabricante**
   - Cada modelo puede tener un método diferente
   - Busca en la documentación del PM8

2. **Usa la aplicación móvil**
   - Muchos fabricantes tienen apps para configurar
   - Busca en App Store/Play Store

3. **Contacta al proveedor**
   - El proveedor puede darte acceso remoto
   - O puede configurarlo por ti

---

## 📞 Contacto con el Proveedor

Si después de seguir esta guía el gabinete aún no se conecta, contacta al proveedor con esta información:

1. **Cabinet ID:** `GT042250704279`
2. **Modelo:** PM8
3. **Problema:** No se conecta a WsCharge / No aparece ONLINE
4. **Configuración actual:**
   - Servidor: `api.w-dian.cn`
   - OCODE: `samuelcharge`
   - Tipo de conexión: WiFi/Ethernet/4G
5. **Mensajes de error** (si los hay)

---

## 📚 Recursos Adicionales

- [Guía de Integración de Dispositivos](./device-integration.md) - Para integración con tu API
- [API WsCharge](./../api/wscharge.md) - Documentación de la API
- [Scripts de Diagnóstico](../README.md) - Scripts útiles para verificar estado

---

## ✅ Checklist de Configuración

Usa este checklist para asegurarte de que todo esté configurado:

- [ ] Gabinete encendido y funcionando
- [ ] Conexión a internet configurada (WiFi/Ethernet/4G)
- [ ] URL del servidor configurada: `wss://api.w-dian.cn`
- [ ] OCODE configurado: `samuelcharge`
- [ ] Cabinet ID verificado: `GT042250704279`
- [ ] Gabinete registrado en WsCharge API
- [ ] Gabinete aparece como ONLINE en WsCharge
- [ ] Estado sincronizado en tu base de datos local

---

¡Una vez completado este checklist, tu gabinete debería aparecer como ONLINE! 🎉

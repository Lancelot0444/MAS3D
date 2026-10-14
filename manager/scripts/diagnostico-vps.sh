#!/usr/bin/env bash
# MAS3D Manager · Diagnóstico del VPS (SOLO LECTURA)
# No instala, no borra, no reinicia y no cambia nada. No muestra contraseñas.
# Copiar todo y pegar en: Coolify → Servers → localhost → Terminal, o en la terminal del navegador de Hostinger.
echo "===== 1. SISTEMA ====="
grep PRETTY_NAME /etc/os-release; uname -r; uptime -p; echo "Carga (1/5/15 min): $(cut -d' ' -f1-3 /proc/loadavg)"
echo "===== 2. RECURSOS ====="
echo "Núcleos: $(nproc)"; free -m; S=$(swapon --show 2>/dev/null); echo "Swap: ${S:-NO HAY SWAP}"
df -h / | tail -1
echo "===== 3. CONTENEDORES (memoria y CPU en este momento) ====="
docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}' 2>/dev/null | sort -k4 -h -r | head -25
echo "===== 4. CONTENEDORES (estado y reinicios) ====="
docker ps -a --format '{{.Names}} | {{.Image}} | {{.Status}}' 2>/dev/null | head -40
echo "===== 5. PROCESOS FUERA DE DOCKER QUE MÁS CONSUMEN ====="
ps -eo user,%cpu,%mem,rss,comm --sort=-%mem | head -10
echo "===== 6. ESPACIO DE DOCKER ====="
docker system df 2>/dev/null
echo "===== 7. COOLIFY ====="
docker inspect coolify --format 'Imagen: {{.Config.Image}}' 2>/dev/null
docker ps --format '{{.Names}}' 2>/dev/null | grep -E 'coolify-proxy|traefik|caddy' | sed 's/^/Proxy: /'
echo "===== 8. PUERTOS PÚBLICOS ====="
ss -tlnH 2>/dev/null | awk '{print $4}' | grep -vE '^(127\.|\[::1\])' | sort -u
echo "===== 9. SEGURIDAD BÁSICA ====="
echo "Firewall: $(ufw status 2>/dev/null | head -1 || echo 'ufw no instalado')"
echo "Acceso root por SSH: $(sshd -T 2>/dev/null | grep -i '^permitrootlogin' | awk '{print $2}')"
echo "Acceso SSH con contraseña: $(sshd -T 2>/dev/null | grep -i '^passwordauthentication' | awk '{print $2}')"
echo "Fail2ban: $(systemctl is-active fail2ban 2>/dev/null)"
echo "Actualizaciones automáticas: $(systemctl is-active unattended-upgrades 2>/dev/null)"
echo "Paquetes por actualizar: $(apt list --upgradable 2>/dev/null | grep -c upgradable)"
echo "Reinicio pendiente: $([ -f /var/run/reboot-required ] && echo SÍ || echo no)"
echo "===== FIN ====="

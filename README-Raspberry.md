# DePara no Raspberry Pi

Este guia explica como instalar e configurar o DePara no Raspberry Pi para inicialização automática e acesso pelo menu.

## 🚀 Instalação Rápida

### 1. Preparar o Sistema

```bash
# Atualizar o sistema
sudo apt update && sudo apt upgrade -y

# Instalar dependências básicas
sudo apt install -y curl git
```

### 2. Instalar o DePara

```bash
# Navegar para o diretório do projeto
cd /home/pi/DePara

# Executar script de instalação
chmod +x install-raspberry.sh
./install-raspberry.sh
```

### 3. Iniciar o DePara

```bash
# Iniciar manualmente
depara start

# Ou usar o comando completo
./start-depara.sh start
```

## 📱 Acesso pelo Menu

Após a instalação, o DePara estará disponível em:

- **Menu Principal**: Aplicações > Utilitários > DePara
- **Desktop**: Ícone do DePara
- **Terminal**: Comando `depara`

## 🔄 Inicialização Automática

O DePara será iniciado automaticamente:

1. **No boot do sistema** (via systemd)
2. **No login do usuário** (via autostart)
3. **Com indicador visual** na barra de status

## 🛠️ Comandos Disponíveis

### Comandos Básicos

```bash
# Iniciar DePara
depara start

# Parar DePara
depara stop

# Reiniciar DePara
depara restart

# Ver status
depara status

# Abrir no navegador
depara open
```

### Comando de Status

```bash
# Menu interativo de status
depara-status
```

## 🔧 Configuração Manual

### 1. Serviço Systemd

```bash
# Ver status do serviço
sudo systemctl status depara.service

# Iniciar serviço
sudo systemctl start depara.service

# Parar serviço
sudo systemctl stop depara.service

# Habilitar inicialização automática
sudo systemctl enable depara.service

# Desabilitar inicialização automática
sudo systemctl disable depara.service
```

### 2. Logs do Sistema

```bash
# Ver logs do serviço
sudo journalctl -u depara.service -f

# Ver logs de inicialização
tail -f /home/pi/DePara/logs/depara-startup.log
```

### 3. Configuração de Porta

Para alterar a porta padrão (3000):

```bash
# Editar arquivo de serviço
sudo nano /etc/systemd/system/depara.service

# Alterar a linha:
Environment=PORT=3000

# Recarregar serviço
sudo systemctl daemon-reload
sudo systemctl restart depara.service
```

## 🌐 Acesso Remoto

Para acessar o DePara de outros dispositivos na rede:

### 1. Descobrir IP do Raspberry Pi

```bash
# Ver IP local
hostname -I

# Ou usar
ip addr show | grep inet
```

### 2. Acessar via Navegador

```
http://[IP_DO_RASPBERRY]:3000
```

Exemplo: `http://192.168.1.100:3000`

### 3. Configurar Firewall (se necessário)

```bash
# Permitir porta 3000
sudo ufw allow 3000

# Ver status do firewall
sudo ufw status
```

## 🔍 Solução de Problemas

### DePara não inicia

```bash
# Verificar logs
depara status
sudo journalctl -u depara.service -n 50

# Verificar se a porta está em uso
sudo netstat -tlnp | grep :3000

# Reiniciar serviço
sudo systemctl restart depara.service
```

### Problemas de Permissão

```bash
# Verificar permissões
ls -la /home/pi/DePara/

# Corrigir permissões
chmod +x /home/pi/DePara/start-depara.sh
chown -R pi:pi /home/pi/DePara/
```

### Node.js não encontrado

```bash
# Verificar instalação
node --version
npm --version

# Reinstalar Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

## 📊 Monitoramento

### Status em Tempo Real

```bash
# Ver status contínuo
watch -n 5 'depara status'

# Ver uso de recursos
htop
```

### Logs de Aplicação

```bash
# Ver logs de inicialização
tail -f /home/pi/DePara/logs/depara-startup.log

# Ver logs do sistema
sudo journalctl -u depara.service -f
```

## 🗑️ Desinstalação

Para remover completamente o DePara:

```bash
# Executar script de desinstalação
chmod +x uninstall-raspberry.sh
./uninstall-raspberry.sh
```

## 📋 Checklist de Instalação

- [ ] Sistema atualizado
- [ ] Node.js instalado
- [ ] DePara instalado
- [ ] Serviço systemd configurado
- [ ] Arquivo .desktop criado
- [ ] Inicialização automática habilitada
- [ ] DePara acessível pelo menu
- [ ] DePara iniciando automaticamente
- [ ] Acesso via navegador funcionando
- [ ] Logs sendo gerados

## 🆘 Suporte

Se encontrar problemas:

1. Verifique os logs: `depara status`
2. Consulte a documentação: `README.md`
3. Verifique o status do serviço: `sudo systemctl status depara.service`
4. Reinicie o serviço: `sudo systemctl restart depara.service`

## 📝 Notas Importantes

- O DePara roda na porta 3000 por padrão
- Os logs são salvos em `/home/pi/DePara/logs/`
- O serviço é executado como usuário `pi`
- A inicialização automática é configurada via systemd
- O acesso pelo menu é configurado via arquivo .desktop

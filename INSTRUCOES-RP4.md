# 🚀 DePara - Teste Direto no Raspberry Pi 4

## 📋 **Guia Rápido para Execução**

### **1. Transferir Arquivos para o Raspberry Pi 4**

```bash
# Opção 1: Usando SCP (do seu computador)
scp -r /caminho/para/DePara pi@[IP_DO_RASPBERRY]:~

# Opção 2: Usando cartão SD
# Copie a pasta DePara diretamente para o cartão SD
```

### **2. Preparar o Ambiente**

```bash
# Conectar ao Raspberry Pi via SSH
ssh pi@[IP_DO_RASPBERRY_PI]

# Navegar para o diretório do projeto
cd DePara

# Tornar scripts executáveis
chmod +x install-raspbian.sh
chmod +x test-rp4.sh
```

### **3. Executar Teste Completo**

```bash
# Executar script de teste (recomendado)
bash test-rp4.sh
```

### **4. Instalação e Execução**

```bash
# Se tudo estiver OK, executar instalação
./install-raspbian.sh

# Iniciar aplicação
npm start
```

### **5. Testar Funcionalidades**

```bash
# Verificar se aplicação está rodando
curl http://localhost:3000/health

# Verificar logs
tail -f logs/app.log
```

## 🎯 **O que foi Otimizado para Raspberry Pi 4**

### **✅ Correções Implementadas:**

1. **Content Security Policy (CSP) Compliance**
   - Removidos todos os event handlers inline
   - Implementados event listeners seguros
   - Interface compatível com políticas de segurança modernas

2. **Sistema de Logging Estruturado**
   - Logs com emojis e cores para melhor visualização
   - Metadados detalhados para debugging
   - Envio automático de logs críticos para servidor
   - Controle de tamanho de histórico (100 entradas)

3. **Controle de Carregamento Inteligente**
   - Sistema de debouncing (1 segundo) para evitar chamadas duplicadas
   - Controle de estado para múltiplas operações simultâneas
   - Otimização de recursos do Raspberry Pi

4. **Validação Visual em Tempo Real**
   - Feedback imediato nos campos de entrada
   - Estados visuais (válido/inválido) com cores
   - Tooltips informativos nos botões
   - Animações suaves para feedback

5. **Performance Otimizada**
   - Controle de memória aprimorado
   - Redução de operações de I/O
   - Buffer de logs para menor impacto no disco
   - Configurações específicas para Raspberry Pi

## 📊 **Monitoramento em Tempo Real**

```bash
# Monitor de recursos
htop

# Temperatura do CPU
watch -n 1 vcgencmd measure_temp

# Logs estruturados
tail -f logs/app.log | grep -E "(SUCCESS|ERROR|WARNING)"
```

## 🌐 **Acesso à Interface**

Após iniciar a aplicação:

1. **Localmente no Raspberry Pi:**
   ```
   http://localhost:3000
   ```

2. **De outro dispositivo na rede:**
   ```
   http://[IP_DO_RASPBERRY_PI]:3000
   ```

3. **Descobrir IP do Raspberry Pi:**
   ```bash
   hostname -I
   ```

## 🔧 **Teste das Funcionalidades Corrigidas**

### **Interface Web:**
- [ ] Dashboard carrega sem erros CSP
- [ ] Campos de operação com validação visual
- [ ] Botões de operação funcionam corretamente
- [ ] Logs estruturados aparecem no console

### **Operações de Arquivos:**
- [ ] Mover arquivos funciona
- [ ] Copiar arquivos funciona
- [ ] Apagar arquivos funciona
- [ ] Operações recursivas funcionam

### **Performance:**
- [ ] Sem carregamentos duplicados
- [ ] Interface responsiva
- [ ] Logs não sobrecarregam o sistema

## 🚨 **Solução de Problemas**

### **Problema: Porta 3000 ocupada**
```bash
# Verificar processo na porta 3000
sudo netstat -tlnp | grep :3000

# Matar processo se necessário
sudo kill -9 [PID]
```

### **Problema: Memória insuficiente**
```bash
# Verificar memória
free -h

# Aumentar swap se necessário
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### **Problema: Aplicação não inicia**
```bash
# Verificar logs
tail -f logs/app.log

# Verificar Node.js
node --version

# Testar manualmente
node src/main.js
```

## 📞 **Suporte**

Se encontrar problemas durante o teste:

1. Execute o script de teste: `bash test-rp4.sh`
2. Verifique os logs: `tail -f logs/app.log`
3. Consulte: `README-Raspbian.md`

---

**🍓 Sistema DePara totalmente otimizado para Raspberry Pi 4!** 🚀

**Data das correções:** $(date)
**Versão testada:** 2.0.0
**Compatibilidade:** Raspberry Pi 4 com Raspbian

# DePara - Gerenciador Automatizado de Arquivos

## 📋 Descrição

DePara é uma aplicação Node.js simplificada e poderosa para gerenciamento automatizado de arquivos. Oferece operações de mover, copiar e apagar arquivos com agendamento flexível, backup automático e controle total sobre a estrutura de pastas. Perfeita para automação de tarefas de arquivo em qualquer ambiente.

## 🚀 Funcionalidades

### 🗂️ **Operações de Arquivos**
- **Mover Arquivos**: Move arquivos entre pastas com backup automático
- **Copiar Arquivos**: Copia arquivos preservando o original
- **Apagar Arquivos**: Remove arquivos com backup automático
- **Agendamento Flexível**: De segundos até dias de intervalo
- **Edição de Tarefas**: Modifique operações agendadas existentes
- **Controle Total**: Cancele ou edite tarefas a qualquer momento
- **Operações em Lote**: Processa todos os arquivos de uma pasta
- **Preservação de Estrutura**: Mantém ou achata estrutura de pastas conforme preferência

### 🔄 **Automação e Templates**
- **Templates Pré-configurados**: Cenários comuns prontos para uso
  - 📦 **Backup**: Diário, por hora, incremental
  - 🧹 **Limpeza**: Temporários, logs antigos, arquivos velhos
  - 📁 **Organização**: Por tipo, por data, por tamanho
  - 🔄 **Sincronização**: Espelhamento, backup bidirecional
  - ⚙️ **Processamento**: Importação, arquivamento automático

### 🛡️ **Sistema de Proteção Inteligente**
- **Arquivos Críticos Protegidos**: Resilio Sync, sistema e temporários
- **Ignorar Automático**: Não interrompe sincronização ou sistema
- **Compatibilidade Total**: Windows, Linux, macOS
- **Verificação Manual**: Teste se arquivo seria ignorado

### 📊 **Monitoramento e Controle**
- **Dashboard Web**: Interface amigável para controle total
- **API REST Completa**: Integração com outros sistemas
- **Logs Estruturados**: Monitoramento detalhado de operações
- **Backup Automático**: Proteção antes de qualquer operação
- **Filtros Avançados**: Por extensão, tamanho, data, padrão

### 🔧 **Conversão e Mapeamento**
- **Conversão de Dados**: Transformação entre diferentes formatos (CSV, JSON, XML)
- **Mapeamento Inteligente**: Sistema de regras para mapeamento automático de campos
- **Validação Automática**: Verificação de integridade dos dados
- **Transformações**: Limpeza, formatação, validação

### 🖼️ **Slideshow de Imagens**
- **Visualização Fullscreen**: Apresentação de imagens em tela cheia
- **Navegação Inteligente**: Teclado, mouse e toque
- **Busca Recursiva**: Inclui todas as subpastas automaticamente
- **Filtros Avançados**: Seleção por tipo de arquivo
- **Controles Intuitivos**: ESC para sair, setas para navegar

## 📋 Pré-requisitos

- **Node.js**: Versão 16.0.0 ou superior
- **npm**: Versão 8.0.0 ou superior
- **Git**: Para clonar o repositório

### Verificação das Versões

```bash
node --version
npm --version
git --version
```

## 🛠️ Instalação

### 🚀 **Instalação Automática (Recomendado)**

#### Windows
```batch
# Execute o instalador automático
install.bat
```

#### Linux/macOS
```bash
# Execute o instalador automático
./install.sh
```

O instalador fará automaticamente:
- ✅ Verificação do Node.js e npm
- ✅ Instalação de todas as dependências
- ✅ Criação da estrutura de pastas (backups, logs, temp)
- ✅ Configuração básica do ambiente
- ✅ Instruções de uso

### 🔧 **Instalação Manual**

#### 1. Clonar o Repositório
```bash
git clone https://github.com/yopastorelli/DePara.git
cd DePara
```

#### 2. Instalar Dependências
```bash
npm install
```

#### 3. Configurar Ambiente
```bash
# Windows
copy env.example .env
notepad .env

# Linux/macOS
cp env.example .env
nano .env
```

#### 4. Executar a Aplicação
```bash
# Modo desenvolvimento
npm run dev

# Modo produção
npm start
```

### 🌐 **Acesso Após Instalação**

Após iniciar, acesse:
- **Interface Web**: http://localhost:3000/ui
- **API**: http://localhost:3000/api
- **Documentação**: http://localhost:3000/api/docs

## 🎯 Como Usar

### 🌐 **Interface Web (Recomendado para Iniciantes)**

Acesse `http://localhost:3000/ui` e use a interface amigável para:

#### 1. **Operações Imediatas**
- **Mover/Copiar/Apagar** arquivos individualmente
- **Backup automático** antes de qualquer operação
- **Visualização** do progresso em tempo real

#### 2. **Agendamento Automático**
- Configure operações recorrentes (a cada 5 minutos, 1 hora, diariamente)
- Use **templates pré-configurados** para cenários comuns
- **Monitore** operações agendadas ativas

#### 3. **Templates Rápidos**
- **Backup Diário**: Configure backup automático de pastas importantes
- **Limpeza de Logs**: Remova arquivos de log antigos automaticamente
- **Organização por Tipo**: Mova arquivos para pastas organizadas por extensão
- **Sincronização**: Mantenha pastas espelhadas

#### 4. **Slideshow de Imagens**
- Clique no botão **"Slideshow de Imagens"** no dashboard
- Selecione a pasta contendo as imagens
- Escolha os tipos de arquivo desejados (JPG, PNG, GIF, etc.)
- Defina a profundidade de busca em subpastas
- Inicie a apresentação em fullscreen
- Use as setas do teclado, roda do mouse ou toque para navegar
- Pressione **ESC** ou clique no botão **X** para sair

### 🔌 **API REST (Para Integração)**

#### Endpoints Principais
- `GET /api/health` - Status da aplicação
- `POST /api/files/execute` - Operações imediatas em arquivos
- `POST /api/files/schedule` - Agendamento de operações
- `GET /api/files/templates` - Templates pré-configurados
- `GET /api/files/images/:folderPath` - Listar imagens para slideshow
- `GET /api/files/image/:imagePath` - Servir imagem para slideshow
- `POST /api/convert` - Conversão de dados
- `POST /api/map` - Mapeamento de campos

#### Exemplos Práticos

```bash
# Verificar status
curl http://localhost:3000/api/health

# Mover arquivo com backup e preservação de estrutura
curl -X POST http://localhost:3000/api/files/execute \
  -H "Content-Type: application/json" \
  -d '{
    "action": "move",
    "sourcePath": "/origem/arquivo.txt",
    "targetPath": "/destino/arquivo.txt",
    "options": {
      "backupBeforeMove": true,
      "preserveStructure": true
    }
  }'

# Agendar backup diário com preservação de estrutura
curl -X POST http://localhost:3000/api/files/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "frequency": "1d",
    "action": "copy",
    "sourcePath": "/dados",
    "targetPath": "/backup/diario",
    "options": {
      "batch": true,
      "preserveStructure": true
    }
  }'

# Aplicar template de limpeza
curl -X POST http://localhost:3000/api/files/templates/cleanup/temp_files/apply \
  -H "Content-Type: application/json" \
  -d '{"sourcePath": "/minha_pasta_temp"}'

# Verificar se arquivo seria ignorado
curl -X POST http://localhost:3000/api/files/check-ignore \
  -H "Content-Type: application/json" \
  -d '{"filePath": "/sync/.sync/Archive", "filename": "Archive"}'

# Listar padrões de arquivos protegidos
curl http://localhost:3000/api/files/ignored-patterns

# Listar imagens para slideshow (busca recursiva)
curl "http://localhost:3000/api/files/images/caminho/para/imagens?extensions=jpg,png,gif&maxDepth=5"

# Verificar se arquivo seria ignorado
curl -X POST http://localhost:3000/api/files/check-ignore \
  -H "Content-Type: application/json" \
  -d '{"filePath": "/sync/.sync/Archive", "filename": "Archive"}'
```

## 🧪 Testes

```bash
# Executar todos os testes
npm test

# Executar testes em modo watch
npm run test:watch

# Executar testes com cobertura
npm run test:coverage
```

## 🔧 Desenvolvimento

### Scripts Disponíveis

- `npm start` - Inicia a aplicação em modo produção
- `npm run dev` - Inicia em modo desenvolvimento com nodemon
- `npm run start:bg` - Inicia em segundo plano com PM2
- `npm run start:bg:prod` - Inicia em produção com PM2
- `npm run stop:bg` - Para a aplicação em segundo plano
- `npm run restart:bg` - Reinicia a aplicação em segundo plano
- `npm run status` - Verifica status da aplicação PM2
- `npm run logs` - Visualiza logs da aplicação PM2
- `npm test` - Executa os testes
- `npm run lint` - Executa o linter ESLint
- `npm run setup` - Instala dependências
- `npm run setup:bg` - Instala dependências + PM2 global

### Estrutura do Projeto

```
DePara/
├── src/           # Código fonte
├── tests/         # Testes automatizados
├── docs/          # Documentação adicional
├── logs/          # Arquivos de log
├── package.json   # Dependências e scripts
├── .gitignore     # Arquivos ignorados pelo Git
├── env.example    # Exemplo de variáveis de ambiente
└── README.md      # Este arquivo
```

## 📝 Logs

A aplicação gera logs estruturados para facilitar o debug e monitoramento:

- **Nível**: info, warn, error, debug
- **Localização**: `logs/app.log`
- **Formato**: JSON estruturado com timestamp

## 🤝 Como Contribuir

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está licenciado sob a Licença MIT - veja o arquivo [LICENSE](LICENSE) para detalhes.

## 🆘 Suporte

Se encontrar algum problema ou tiver dúvidas:

1. Verifique os logs da aplicação
2. Consulte a documentação da API
3. Abra uma issue no GitHub
4. Entre em contato com a equipe de desenvolvimento

## 🔄 Atualizações

Para manter o projeto atualizado:

```bash
git pull origin main
npm install
```

---

**DePara** - Transformando dados com simplicidade e eficiência! 🚀

# 32º BPM — Sistema de Controle de Folgas

## Como publicar (passo a passo)

### 1. Configurar o Supabase

1. Acesse **supabase.com** e entre na sua conta
2. Clique em **New Project** → dê um nome (ex: `folgas-32bpm`) → escolha uma senha → clique em **Create Project**
3. Aguarde criar (1-2 minutos)
4. No menu lateral, vá em **SQL Editor**
5. Cole todo o conteúdo do arquivo `supabase_setup.sql` e clique em **Run**
6. Vá em **Project Settings → API**
7. Copie a **Project URL** e a **anon public key** — você vai precisar no próximo passo

---

### 2. Subir o código no GitHub

1. Crie um repositório novo no GitHub (ex: `folgas-32bpm`)
2. Faça upload de todos os arquivos desta pasta para o repositório

---

### 3. Publicar na Vercel

1. Acesse **vercel.com** e entre com sua conta GitHub
2. Clique em **Add New → Project**
3. Selecione o repositório `folgas-32bpm`
4. Antes de clicar em Deploy, clique em **Environment Variables** e adicione:
   - `REACT_APP_SUPABASE_URL` → cole a Project URL do Supabase
   - `REACT_APP_SUPABASE_ANON_KEY` → cole a anon key do Supabase
5. Clique em **Deploy**
6. Aguarde 2-3 minutos → seu link estará pronto! 🎉

---

### Pronto!
O sistema estará acessível por link para qualquer policial, no celular ou computador.

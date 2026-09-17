# APROVA DOPAMINE

Sistema de aprovação de artes e vídeos: a agência sobe as peças, o cliente entra
com e-mail e senha, vê cada peça, **aprova** ou **pede ajuste** com um comentário.
Cada nova versão fica guardada (v1, v2, v3…) e os dois lados recebem notificação.

- **Front**: HTML/CSS/JS puro, sem build. Publica no GitHub Pages igual ao portfólio.
- **Back**: Supabase (login, banco, arquivos). Plano gratuito atende bem no começo.

---

## Passo a passo (uma vez só, ~15 min)

### 1. Criar o projeto no Supabase
1. Vá em <https://supabase.com> → **New project**.
2. Escolha uma região (São Paulo deixa mais rápido) e guarde a senha do banco.

### 2. Criar as tabelas
1. No Supabase, abra **SQL Editor** → **New query**.
2. Cole o conteúdo inteiro de [`sql/schema.sql`](sql/schema.sql) e clique em **Run**.
   Isso cria tabelas, permissões, gatilhos de notificação e o bucket de arquivos.

### 3. Ligar o front no Supabase
1. Supabase → **Project Settings → API**. Copie **Project URL** e a chave **anon public**.
2. Abra [`js/config.js`](js/config.js) e cole as duas nos lugares indicados.
   > A `anon key` é pública de propósito — quem protege os dados são as regras de
   > RLS do `schema.sql`, não a chave.

### 4. Testar local
Precisa ser servido por HTTP — abrir o `index.html` com dois cliques **não funciona**
(módulos ES são bloqueados em `file://`). Tem um servidor pronto na pasta:

```bash
powershell -ExecutionPolicy Bypass -File serve.ps1
```

Depois abra <http://localhost:5173>. `Ctrl+C` para parar.

### 5. Virar "agência"
Toda conta nova nasce como **cliente**. Crie a sua conta no app e depois rode no
SQL Editor, trocando o e-mail:

```sql
update public.profiles set role = 'agency' where email = 'voce@exemplo.com';
```

Saia e entre de novo. Agora você vê os botões de criar projeto e enviar peças.

### 6. Colocar no ar
Suba a pasta para um repositório no GitHub e ligue **Settings → Pages → branch `main`**.
Em **Supabase → Authentication → URL Configuration**, adicione a URL do Pages em
*Site URL* e em *Redirect URLs*.

---

## Como usa no dia a dia

**Você (agência)**
1. O cliente cria a conta dele no link do sistema.
2. Você cria um projeto e escolhe esse cliente na lista.
3. Envia as peças. Cada envio notifica o cliente.
4. Se ele pedir ajuste, você sobe a **v2** na mesma peça — o histórico fica junto.

**Cliente**
1. Entra com e-mail e senha.
2. Vê só os projetos dele.
3. Abre a peça, escreve o comentário e clica em **Aprovar** ou **Pedir ajuste**.

---

## Notificações

Já funciona de cara o **sininho** dentro do app (contador de não lidas).

Para receber também por **e-mail**, siga as instruções no topo de
[`supabase/functions/notify-email/index.ts`](supabase/functions/notify-email/index.ts).
É opcional e o resto do sistema funciona sem.

---

## Limites que valem saber

- **Tamanho de arquivo**: o padrão do Supabase é 50 MB por upload. Para vídeos maiores,
  aumente em **Storage → Settings → Upload file size limit** (planos pagos vão até 50 GB).
- **Armazenamento grátis**: 1 GB no plano free. Vídeo consome rápido — apague projetos
  antigos ou suba de plano quando encher.
- **Papel "agência" vê tudo**: qualquer conta com `role = 'agency'` enxerga todos os
  projetos. Isso é proposital para uma agência só. Se um dia entrar mais gente com
  acesso parcial, é preciso mudar a policy `projects_select`.
- **Cadastro é aberto**: qualquer um com o link pode criar conta de cliente, mas só vê
  projetos onde você o colocou. Para fechar, desligue *Enable signup* em
  **Authentication → Providers → Email** e crie os usuários pelo painel.

---

## Identidade de marca

O sistema segue o **manual da dopamine (edição 2026)**.

**Paleta travada nas 4 cores oficiais** — nenhuma cor de apoio fora delas:

| | hex | uso no sistema |
|---|---|---|
| Paper | `#F7F3EA` | fundo do tema claro |
| Azul-marinho | `#1E1F5A` | texto, cards no tema escuro, status "aprovado" |
| Preto Sinapse | `#0B0C21` | fundo do tema escuro, área do player |
| Vermelho | `#E30613` | CTA, botão Aprovar, status "ajuste pedido", manchete de seção |

> Como a paleta não tem verde nem âmbar, os status usam **contraste em vez de mais cor**:
> `aguardando` = contorno neutro, `aprovado` = azul-marinho sólido, `ajuste pedido` =
> contorno vermelho. Em fundo escuro, "aprovado" inverte para paper — azul-marinho sobre
> sinapse não tem contraste.

**Tipografia — três vozes:** Degular em títulos, Instrument Serif no corpo, Garet em
destaques. Degular e Garet são licenciadas e não podem ser servidas numa página pública,
então o sistema usa as substitutas que o **próprio manual documenta** (pág. 15):
Degular → **Sora**, Garet → **Quicksand**. Instrument Serif é aberta e entra de verdade.
Se você licenciar as originais para web, troque o `@import` e as variáveis
`--font-title` / `--font-quote` no topo de [`css/style.css`](css/style.css) — nada mais muda.

> Micro-texto de interface (rótulos, botões, datas, badges) usa Sora, não Instrument Serif.
> Serifa de display em 11px não se sustenta numa tela de trabalho — a voz do corpo de texto
> fica onde ela é lida de verdade: descrições, comentários e textos de abertura.

**Logotipo:** o manual é explícito — arquivo fechado, nunca recriado em tipografia. O
sistema por isso **não desenha a marca com fonte nenhuma**; ele carrega os arquivos oficiais
de [`assets/`](assets/README.md), em `.svg` ou `.png`. Enquanto eles não estiverem lá, o topo
mostra só `APROVA`, sem marca. Os nomes de arquivo esperados estão em
[`assets/README.md`](assets/README.md).

> Existe um `Brand Kit DOPAMINE.png` mais antigo circulando, com monograma "dp",
> Cinzel/Montserrat e branco `#FFFFFF`. Ele **não** foi usado: o manual edição 2026
> (pág. 13) diz que o novo símbolo "substitui os monogramas 'a' e 'dp' usados em peças
> anteriores". Na dúvida entre os dois documentos, vale o manual.

---

## Estrutura

```
index.html                 casca da página
css/style.css              paleta, tipografia e tema claro/escuro
serve.ps1                  servidor local para testar antes de publicar
assets/                    logotipo e selo (ver assets/README.md)
js/config.js               SUA url + anon key
js/app.js                  toda a lógica (login, projetos, peças, comentários)
sql/schema.sql             tabelas, permissões (RLS), gatilhos, bucket
supabase/functions/
  notify-email/index.ts    e-mail de aviso (opcional)
```

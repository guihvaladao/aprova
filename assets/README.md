# Arquivos de marca

O manual (pág. 12 e 13) é explícito: **o logotipo "dopamine" é um arquivo fechado
e nunca é recriado tipograficamente.** Por isso o sistema não desenha nada com fonte —
ele carrega os arquivos oficiais daqui. **Enquanto eles não estiverem nesta pasta, o topo
mostra só `APROVA`**, sem marca nenhuma. Isso é proposital.

## Arquivos esperados

Aceita `.svg` (ideal) ou `.png`. O sistema tenta o `.svg` primeiro e cai para o `.png`
sozinho — você não precisa mudar nada no código, só salvar com estes nomes:

| arquivo | o que é | onde aparece |
|---|---|---|
| `selo.svg` ou `selo.png` | selo — o "d" dentro do círculo, **em vermelho** | favicon, topo e tela de login (tema claro) |
| `selo-claro.svg` / `.png` | o mesmo selo **em paper** `#F7F3EA` | tema escuro |
| `wordmark.svg` / `.png` | logotipo "dopamine" **vermelho** | ao lado do selo, tema claro |
| `wordmark-claro.svg` / `.png` | logotipo "dopamine" **em paper** | tema escuro |

Os dois `wordmark` são opcionais: sem eles o topo fica com o selo + `APROVA`, que já
funciona. O selo é o que mais faz falta, porque é ele que vira o favicon.

## Duas coisas na hora de exportar

**1. Fundo transparente, não preto.** O selo que circula por aí está exportado em
vermelho sobre fundo preto. Um PNG com o quadrado preto vai aparecer como um bloco preto
em cima do fundo paper. Exporte com **fundo transparente** — só o círculo e o "d".

**2. Duas cores, não uma.** O manual (pág. 13) diz para aplicar o símbolo em vermelho
sobre paper **ou** em paper sobre azul-marinho/preto sinapse — nunca vermelho sobre fundo
escuro. Por isso são dois arquivos: o sistema troca sozinho quando o tema muda.

Se você só tiver a versão vermelha, salve como `selo.svg` e o tema escuro vai usar a mesma —
funciona, mas fica fora da regra do manual.

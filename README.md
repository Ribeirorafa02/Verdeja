# VerdeJá — Aplicativo Web Completo

## O que é
Marketplace web responsivo para verduras, com:
- Cliente: cadastro, login, catálogo, busca, carrinho, checkout, pedidos.
- Vendedor: cadastro, aprovação pelo admin, produtos, estoque e pedidos.
- Entregador: cadastro, aprovação, aceitar entrega e marcar como entregue.
- Administrador: dashboard, usuários, aprovação/bloqueio e comissão.
- Comissão padrão: 10%.

## Como executar
Requer Node.js 20 ou superior.

```bash
npm install
npm start
```

Abra:
http://localhost:3000

## Administrador inicial
Por padrão:
- E-mail: admin@verdeja.com
- Senha: admin123

ANTES DE PUBLICAR, altere essas credenciais com variáveis de ambiente:
- ADMIN_EMAIL
- ADMIN_PASSWORD
- JWT_SECRET

Exemplo:
ADMIN_EMAIL=seuemail@dominio.com ADMIN_PASSWORD=uma_senha_forte JWT_SECRET=uma_chave_longa npm start

## Publicação
O projeto está preparado para hospedagem Node (Render, Railway, VPS etc.).
O armazenamento desta versão usa `data/db.json`, adequado para demonstração/MVP. Para operação comercial com vários usuários, substitua por PostgreSQL/MySQL e armazenamento de imagens.

## Pagamento
O checkout já registra o método escolhido, mas um gateway real (Mercado Pago, Stripe etc.) precisa ser conectado com as credenciais da sua conta e webhooks.

## Entrega
O fluxo de pedido e aceite de entrega funciona no aplicativo. GPS/mapa em tempo real requer integração com Google Maps/Mapbox e permissões do dispositivo.

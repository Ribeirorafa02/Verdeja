
const express = require("express");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "VERDEJA_TROQUE_ESTA_CHAVE_EM_PRODUCAO";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@verdeja.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
fs.mkdirSync(DATA_DIR, {recursive:true});

function freshDB(){
  return {
    settings:{commission:10},
    users:[],
    products:[
      {id:"p1",sellerId:"seed",name:"Alface",description:"Fresca e crocante.",price:4.50,unit:"unidade",stock:50,active:true},
      {id:"p2",sellerId:"seed",name:"Couve",description:"Maço selecionado.",price:5.90,unit:"maço",stock:40,active:true},
      {id:"p3",sellerId:"seed",name:"Tomate",description:"Tomates frescos.",price:8.90,unit:"kg",stock:30,active:true},
      {id:"p4",sellerId:"seed",name:"Rúcula",description:"Folhas fresquinhas.",price:4.90,unit:"maço",stock:30,active:true}
    ],
    orders:[],
    sessions:[]
  };
}
function load(){
  if(!fs.existsSync(DB_FILE)){const d=freshDB();fs.writeFileSync(DB_FILE,JSON.stringify(d,null,2));return d;}
  try{return JSON.parse(fs.readFileSync(DB_FILE,"utf8"))}catch{return freshDB()}
}
let db=load();
function save(){fs.writeFileSync(DB_FILE,JSON.stringify(db,null,2))}
function id(prefix){return prefix+"_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,8)}
function safeUser(u){const {passwordHash,...x}=u;return x}
function tokenFor(u){return jwt.sign({id:u.id,role:u.role},JWT_SECRET,{expiresIn:"7d"})}
function auth(req,res,next){
  const h=req.headers.authorization||"";
  if(!h.startsWith("Bearer "))return res.status(401).json({error:"Não autenticado"});
  try{
    const p=jwt.verify(h.slice(7),JWT_SECRET);
    const u=db.users.find(x=>x.id===p.id);
    if(!u)return res.status(401).json({error:"Usuário não encontrado"});
    req.user=u;next();
  }catch{return res.status(401).json({error:"Sessão expirada"})}
}
function role(...roles){return (req,res,next)=>roles.includes(req.user.role)?next():res.status(403).json({error:"Sem permissão"})}

async function ensureAdmin(){
  if(!db.users.some(u=>u.email===ADMIN_EMAIL)){
    db.users.push({id:"admin",role:"admin",name:"Administrador",email:ADMIN_EMAIL,phone:"",passwordHash:await bcrypt.hash(ADMIN_PASSWORD,10),status:"approved",createdAt:new Date().toISOString()});
    save();
  }
}
ensureAdmin();

app.use(express.json({limit:"1mb"}));
app.use(express.static(path.join(__dirname,"public")));

app.get("/api/health",(req,res)=>res.json({ok:true,name:"VerdeJá",version:"1.0.0"}));

app.post("/api/register",async(req,res)=>{
  const {role,name,email,password,phone,address,store,document,vehicle}=req.body||{};
  if(!["customer","seller","courier"].includes(role))return res.status(400).json({error:"Tipo de conta inválido"});
  if(!name||!email||!password||!phone)return res.status(400).json({error:"Preencha os campos obrigatórios"});
  const em=email.trim().toLowerCase();
  if(db.users.some(u=>u.email===em))return res.status(409).json({error:"Este e-mail já está cadastrado"});
  if(role==="seller"&&!store)return res.status(400).json({error:"Informe o nome da horta/loja"});
  if(role==="courier"&&!vehicle)return res.status(400).json({error:"Informe o veículo"});
  const u={id:id("u"),role,name:name.trim(),email:em,phone:phone.trim(),address:address||"",store:store||"",document:document||"",vehicle:vehicle||"",status:role==="customer"?"approved":"pending",passwordHash:await bcrypt.hash(password,10),createdAt:new Date().toISOString()};
  db.users.push(u);save();
  res.json({user:safeUser(u),token:tokenFor(u)});
});

app.post("/api/login",async(req,res)=>{
  const {email,password}=req.body||{};
  const u=db.users.find(x=>x.email===(email||"").trim().toLowerCase());
  if(!u||!(await bcrypt.compare(password||"",u.passwordHash)))return res.status(401).json({error:"E-mail ou senha incorretos"});
  if(u.status==="blocked")return res.status(403).json({error:"Conta bloqueada"});
  res.json({user:safeUser(u),token:tokenFor(u)});
});
app.get("/api/me",auth,(req,res)=>res.json({user:safeUser(req.user)}));

app.get("/api/products",(req,res)=>{
  const q=(req.query.q||"").toLowerCase();
  const list=db.products.filter(p=>p.active&&(p.name+" "+p.description).toLowerCase().includes(q));
  res.json({products:list});
});
app.post("/api/products",auth,role("seller"),(req,res)=>{
  if(req.user.status!=="approved")return res.status(403).json({error:"Seu cadastro ainda aguarda aprovação"});
  const {name,description,price,unit,stock}=req.body||{};
  if(!name||!(Number(price)>0))return res.status(400).json({error:"Nome e preço são obrigatórios"});
  const p={id:id("p"),sellerId:req.user.id,name:name.trim(),description:description||"",price:Number(price),unit:unit||"unidade",stock:Number(stock||0),active:true};
  db.products.push(p);save();res.json({product:p});
});
app.patch("/api/products/:id",auth,role("seller","admin"),(req,res)=>{
  const p=db.products.find(x=>x.id===req.params.id);
  if(!p)return res.status(404).json({error:"Produto não encontrado"});
  if(req.user.role==="seller"&&p.sellerId!==req.user.id)return res.status(403).json({error:"Sem permissão"});
  Object.assign(p,{name:req.body.name??p.name,description:req.body.description??p.description,price:req.body.price!==undefined?Number(req.body.price):p.price,unit:req.body.unit??p.unit,stock:req.body.stock!==undefined?Number(req.body.stock):p.stock,active:req.body.active!==undefined?!!req.body.active:p.active});
  save();res.json({product:p});
});
app.get("/api/seller/products",auth,role("seller"),(req,res)=>res.json({products:db.products.filter(p=>p.sellerId===req.user.id)}));

app.post("/api/orders",auth,role("customer"),(req,res)=>{
  if(req.user.status!=="approved")return res.status(403).json({error:"Conta não aprovada"});
  const {items,address,payment}=req.body||{};
  if(!Array.isArray(items)||!items.length)return res.status(400).json({error:"Carrinho vazio"});
  if(!address)return res.status(400).json({error:"Informe o endereço"});
  let total=0, lines=[];
  for(const item of items){
    const p=db.products.find(x=>x.id===item.productId&&x.active);
    const qty=Number(item.qty);
    if(!p||qty<1)return res.status(400).json({error:"Produto inválido"});
    if(p.stock<qty)return res.status(400).json({error:`Estoque insuficiente: ${p.name}`});
    lines.push({productId:p.id,sellerId:p.sellerId,name:p.name,unit:p.unit,price:p.price,qty});
    total+=p.price*qty;
  }
  lines.forEach(l=>{const p=db.products.find(x=>x.id===l.productId);p.stock-=l.qty});
  const commission=Number(db.settings.commission)||0;
  const o={id:id("ord"),customerId:req.user.id,customerName:req.user.name,items:lines,total:Number(total.toFixed(2)),commission:Number((total*commission/100).toFixed(2)),sellerAmount:Number((total*(1-commission/100)).toFixed(2)),deliveryFee:0,address,payment:payment||"Pix",status:"new",courierId:null,courierName:null,createdAt:new Date().toISOString()};
  db.orders.push(o);save();res.json({order:o});
});
app.get("/api/orders",auth,(req,res)=>{
  let list=req.user.role==="admin"?db.orders:req.user.role==="customer"?db.orders.filter(o=>o.customerId===req.user.id):req.user.role==="courier"?db.orders.filter(o=>!o.courierId||o.courierId===req.user.id):db.orders.filter(o=>o.items.some(i=>i.sellerId===req.user.id));
  res.json({orders:list.slice().reverse()});
});
app.patch("/api/orders/:id/status",auth,(req,res)=>{
  const o=db.orders.find(x=>x.id===req.params.id);if(!o)return res.status(404).json({error:"Pedido não encontrado"});
  const s=req.body.status;
  const allowed=["preparing","ready","in_delivery","delivered","cancelled"];
  if(!allowed.includes(s))return res.status(400).json({error:"Status inválido"});
  if(req.user.role==="seller"){
    if(!o.items.some(i=>i.sellerId===req.user.id))return res.status(403).json({error:"Sem permissão"});
    if(!["preparing","ready"].includes(s))return res.status(403).json({error:"Status não permitido"});
  }else if(req.user.role==="courier"){
    if(o.courierId!==req.user.id)return res.status(403).json({error:"Aceite a entrega primeiro"});
    if(s!=="delivered"&&s!=="in_delivery")return res.status(403).json({error:"Status não permitido"});
  }else if(req.user.role!=="admin")return res.status(403).json({error:"Sem permissão"});
  o.status=s;save();res.json({order:o});
});
app.post("/api/orders/:id/accept",auth,role("courier"),(req,res)=>{
  if(req.user.status!=="approved")return res.status(403).json({error:"Entregador ainda não aprovado"});
  const o=db.orders.find(x=>x.id===req.params.id);
  if(!o)return res.status(404).json({error:"Pedido não encontrado"});
  if(o.courierId)return res.status(409).json({error:"Entrega já foi aceita"});
  if(!["ready","preparing","new"].includes(o.status))return res.status(400).json({error:"Pedido não disponível"});
  o.courierId=req.user.id;o.courierName=req.user.name;o.status="in_delivery";save();res.json({order:o});
});

app.get("/api/admin/summary",auth,role("admin"),(req,res)=>{
  const sales=db.orders.reduce((s,o)=>s+o.total,0);
  res.json({users:db.users.length,sellers:db.users.filter(u=>u.role==="seller").length,couriers:db.users.filter(u=>u.role==="courier").length,products:db.products.length,orders:db.orders.length,sales,commission:db.orders.reduce((s,o)=>s+o.commission,0),rate:db.settings.commission});
});
app.get("/api/admin/users",auth,role("admin"),(req,res)=>res.json({users:db.users.map(safeUser)}));
app.patch("/api/admin/users/:id/status",auth,role("admin"),(req,res)=>{
  const u=db.users.find(x=>x.id===req.params.id);if(!u)return res.status(404).json({error:"Usuário não encontrado"});
  if(!["approved","blocked","pending"].includes(req.body.status))return res.status(400).json({error:"Status inválido"});
  u.status=req.body.status;save();res.json({user:safeUser(u)});
});
app.patch("/api/admin/settings",auth,role("admin"),(req,res)=>{
  const n=Number(req.body.commission);
  if(isNaN(n)||n<0||n>100)return res.status(400).json({error:"Comissão inválida"});
  db.settings.commission=n;save();res.json({commission:n});
});

app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,()=>console.log(`VerdeJá rodando em http://localhost:${PORT}`));

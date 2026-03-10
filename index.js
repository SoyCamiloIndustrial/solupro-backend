require("dotenv").config()

const express = require("express")
const cors = require("cors")
const { Pool } = require("pg")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const crypto = require("crypto")

const app = express()

app.use(cors({
 origin:["http://localhost:3000"],
 credentials:true
}))

app.use(express.json())

/* =========================
DATABASE
========================= */

const pool = new Pool({
 connectionString:process.env.DATABASE_URL,
 ssl:{rejectUnauthorized:false}
})

pool.connect()
.then(()=>console.log("🟢 PostgreSQL conectado"))
.catch(err=>console.error("DB error",err))

/* =========================
JWT MIDDLEWARE
========================= */

function verifyToken(req,res,next){

 const authHeader=req.headers.authorization

 if(!authHeader){
  return res.status(401).json({error:"Token requerido"})
 }

 const token=authHeader.split(" ")[1]

 try{

  const decoded=jwt.verify(token,process.env.JWT_SECRET)

  req.user=decoded

  next()

 }catch(err){

  return res.status(401).json({error:"Token inválido"})

 }

}

/* =========================
LOGIN NORMAL
========================= */

app.post("/api/login",async(req,res)=>{

 try{

  const {email,password}=req.body

  const result=await pool.query(
   "SELECT * FROM users WHERE email=$1",
   [email]
  )

  if(result.rows.length===0){
   return res.status(401).json({error:"Credenciales inválidas"})
  }

  const user=result.rows[0]

  const valid=await bcrypt.compare(password,user.password)

  if(!valid){
   return res.status(401).json({error:"Credenciales inválidas"})
  }

  const token=jwt.sign(
   {userId:user.id,email:user.email},
   process.env.JWT_SECRET,
   {expiresIn:"7d"}
  )

  res.json({
   token,
   user:{
    id:user.id,
    email:user.email
   }
  })

 }catch(err){

  console.error(err)
  res.status(500).json({error:"Login error"})

 }

})

/* =========================
AUTO LOGIN
========================= */

app.post("/api/auto-login",async(req,res)=>{

 try{

  const {email}=req.body

  const result=await pool.query(
   "SELECT * FROM users WHERE email=$1",
   [email]
  )

  if(result.rows.length===0){
   return res.status(404).json({error:"Usuario no encontrado"})
  }

  const user=result.rows[0]

  const token=jwt.sign(
   {userId:user.id,email:user.email},
   process.env.JWT_SECRET,
   {expiresIn:"7d"}
  )

  res.json({
   token,
   user:{
    id:user.id,
    email:user.email
   }
  })

 }catch(err){

  console.error(err)
  res.status(500).json({error:"Auto login error"})

 }

})

/* =========================
MIS CURSOS
========================= */

app.get("/api/my-courses",verifyToken,async(req,res)=>{

 try{

  const userId=req.user.userId

  const result=await pool.query(
   "SELECT course_id FROM enrollments WHERE user_id=$1",
   [userId]
  )

  const courses=result.rows.map(r=>r.course_id)

  res.json({
   success:true,
   courses
  })

 }catch(err){

  console.error(err)
  res.status(500).json({error:"Error obteniendo cursos"})

 }

})

/* =========================
WEBHOOK WOMPI
========================= */

app.post("/webhook/wompi",async(req,res)=>{

 try{

  const data=req.body.data

  if(!data || !data.transaction){
   return res.status(400).json({error:"Payload inválido"})
  }

  const tx=data.transaction

  const {
   id,
   status,
   amount_in_cents,
   currency,
   customer_email,
   reference,
   signature
  }=tx

  const integrityKey=process.env.WOMPI_INTEGRITY_KEY

  const string=
   id+
   status+
   amount_in_cents+
   currency+
   integrityKey

  const hash=crypto
   .createHash("sha256")
   .update(string)
   .digest("hex")

  if(hash!==signature){
   console.log("❌ Firma inválida")
   return res.status(400).json({error:"Firma inválida"})
  }

  console.log("✅ Firma válida")

  /* guardar transacción */

  await pool.query(
   "INSERT INTO transactions(wompi_id,email,amount,status) VALUES($1,$2,$3,$4)",
   [id,customer_email,amount_in_cents,status]
  )

  if(status!=="APPROVED"){
   return res.json({received:true})
  }

  const email=customer_email
  const courseId=reference

  let user=await pool.query(
   "SELECT id FROM users WHERE email=$1",
   [email]
  )

  let userId

  if(user.rows.length===0){

   const newUser=await pool.query(
    "INSERT INTO users(email) VALUES($1) RETURNING id",
    [email]
   )

   userId=newUser.rows[0].id

  }else{

   userId=user.rows[0].id

  }

  const exist=await pool.query(
   "SELECT id FROM enrollments WHERE user_id=$1 AND course_id=$2",
   [userId,courseId]
  )

  if(exist.rows.length===0){

   await pool.query(
    "INSERT INTO enrollments(user_id,course_id) VALUES($1,$2)",
    [userId,courseId]
   )

   console.log("🎓 acceso concedido")

  }

  res.json({received:true})

 }catch(err){

  console.error(err)
  res.status(500).json({error:"Webhook error"})

 }

})

/* =========================
SERVER
========================= */

const PORT=process.env.PORT || 8080

app.listen(PORT,()=>{
 console.log(`🚀 Servidor corriendo en puerto ${PORT}`)
})
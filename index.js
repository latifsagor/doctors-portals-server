const express = require('express')
const app = express()
const cors = require('cors')
const admin = require('firebase-admin')
require('dotenv').config()

const { MongoClient } = require('mongodb')
const port = process.env.PORT || 5000

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
})

// MiddleWare
app.use(cors())
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.tigkh.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`

// MUST BE CHECK
// console.log(uri)

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})

async function verifyToken(req, res, next) {
  if (req.headers?.authorization?.startsWith('Bearer ')) {
    const token = req.headers.authorization.split(' ')[1]

    try {
      const decodedUser = await admin.auth().verifyIdToken(token)
      req.decodedEmail = decodedUser.email
    } catch {}
  }
  next()
}

async function run() {
  try {
    await client.connect()
    const database = client.db('doctors_portals')
    const appointmentsCollection = database.collection('appointments')
    const usersCollection = database.collection('users')

    // Create Api
    app.post('/appointments', async (req, res) => {
      const appointment = req.body
      const result = await appointmentsCollection.insertOne(appointment)
      // console.log(result)
      res.json(result)
    })

    // Read Api
    app.get('/appointments', async (req, res) => {
      const email = req?.query?.email
      const date = new Date(req.query.date).toLocaleDateString()
      // console.log(date)
      const query = { email: email, date: date }
      const cursor = appointmentsCollection.find(query)
      const result = await cursor.toArray()
      res.json(result)
    })

    // Create New API
    app.post('/users', async (req, res) => {
      const user = req?.body
      const result = await usersCollection.insertOne(user)
      // console.log(result)
      res.json(result)
    })

    app.get('/users/:email', verifyToken, async (req, res) => {
      const email = req.params.email
      const query = { email: email }
      const user = await usersCollection.findOne(query)
      let isAdmin = false
      if (user?.role === 'admin') {
        isAdmin = true
      }
      res.json({ admin: isAdmin })
    })

    app.put('/users', async (req, res) => {
      const user = req.body
      const filter = { email: user?.email }
      const options = { upsert: true }
      const updateDoc = { $set: user }
      const result = await usersCollection.updateOne(filter, updateDoc, options)
      res.json(result)
    })

    app.put('/users/admin', verifyToken, async (req, res) => {
      const user = req.body
      const requester = req.decodedEmail
      if (requester) {
        const requesterAccount = await usersCollection.findOne({
          email: requester,
        })
        if (requesterAccount.role === 'admin') {
          const filter = { email: user?.email }
          const updateDoc = { $set: { role: 'admin' } }
          const result = await usersCollection.updateOne(filter, updateDoc)
          res.json(result)
        }
      } else {
        res
          .status(403)
          .json({ Message: 'You do not have access make an admin.' })
      }
    })
  } finally {
    // await client.close()
  }
}
run().catch(console.dir)

app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})

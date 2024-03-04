const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
const jwt = require('jsonwebtoken')
const port = process.env.BACKEND_PORT || 3000

//middleware
app.use(cors());
app.use(express.json());

// verift token
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if(!authorization){
    return res.status(401).send({
     message: "Invalid authorization"
    })
  }

  const token = authorization?.split(' ')[1];
  jwt.verify(token, process.env.ACCSSS_SECRET, (err, decoded) => {
    if(err) {
      return res.status(403).send({
        message: "Forbiden access"
       })
    }

    req.decoded = decoded;
    next();
  })
}

// mongodb connection
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@atlascluster.5slmxsx.mongodb.net/?retryWrites=true&w=majority&appName=AtlasCluster`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    //create a db and connection
    const database = client.db("mern-demo-db");
    const usersCollection = database.collection("users");
    const classesCollection = database.collection("classes");
    const cartsCollection = database.collection("carts");
    const paymentsCollection = database.collection("payments");
    const enrolledCollection = database.collection("enrolled");
    const appliedCollection = database.collection("applied");

    /** 
     * Users section
      */

    // set token
    // require('crypto').randomBytes(64).toString('hex')
    app.post('/api/set-token', async (req, res) =>{
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCSSS_SECRET, {
        expiresIn: '24h'
      });

      res.send({token})
    })

    // middleware
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = {
        email
      };
      const user = await usersCollection.findOne(query)
      if(user.role === 'admin'){
        next();
      }else{
        return res.status(401).send({
          message: "Unauthorized access"
        })
      }
    }

    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = {
        email
      };
      const user = await usersCollection.findOne(query)
      if(user.role === 'instructor'){
        next();
      }else{
        return res.status(401).send({
          message: "Unauthorized access"
        })
      }
    }

    // create user
    app.post('/users', async (req, res) => {
      const newItem = req.body;
      const result = await usersCollection.insertOne(newItem);
      res.send(result);
    })  

    // get all the users
    app.get('/users', async (_, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    })

    // get single user
    app.get('/users/:id', async (req, res) => {
      const id = req.params.id;
      const query = {
        _id: new ObjectId(id)
      };
      const options = {
        projection: { classId: 1}
      }
      const result = await usersCollection.findOne(query, options);
      res.send(result);
    })

    // delete user - only admin can delete the user
    app.delete('/users/:id', verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = {
        _id: new ObjectId(id)
      };
      const result = await usersCollection.deleteOne(filter);
      res.send(result)
    })








    /** 
     * Classes section
    */
   // create class - only instructors and admin can create classes
    app.post('/classes', verifyJWT, verifyAdmin, verifyInstructor, async (req, res) => {
      const newClass = req.body;
      const result = await classesCollection.insertOne(newClass);
      res.send(result);
    })

    // get all the class
    app.get('/classes', verifyJWT, async (_, res) => {
      const result = await classesCollection.find().toArray();
      res.send(result);
    })

    // get the popular class
    app.get('/classes/popilarity-10', async (_, res) => {
      const sort = {
        totalEnrolled: -1
      }
      const result = await classesCollection.find().sort(sort).limit(10).toArray();
      res.send(result);
    })

    // get the popular instructor
    app.get('/classes/popilar-instructor', async (_, res) => {
      const pipeline = [
        {
          $group: {
            _id: "$instructorEmail",
            totalEnrolled: { $sum: "$totalEnrolled"}
          }
        },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "email",
            as: "instructor"
          }
        },
        {
          $project: {
            _id: 0,
            instructor: {
              $arrayElemAt: ["$instructor", 0]
            },
            totalEnrolled: 1
          }
        },
        {
          $sort: {
            totalEnrolled: -1
          }
        },
        {
          $limit: 5
        }
      ]
      const result = await classesCollection.aggregate(pipeline).toArray();
      res.send(result);
    })
    
    // get classes by prop
    app.get('/classes/:status', async (req, res) => {
      const filter = req.params;
      const result = await classesCollection.find(filter).toArray();
      res.send(result);
    })

    // get single class
    app.get('/classes/:id', async (req, res) => {
      const id = req.params.id;
      const query = {
        _id: new ObjectId(id)
      };
      const result = await classesCollection.findOne(query);
      res.send(result);
    })

    // manage classes
    app.get('/classes-manage', async (_, res) => {
      const result = await classesCollection.find().toArray();
      res.send(result);
    })

    // update classes status and reason
    app.patch('/classes/:id/change', async (req, res) => {
      const id = req.params.id;
      const status = req.body.status;
      const reason =req.body.reason;
      const filter = {
        _id: new ObjectId(id)
      };
      const options = { upsert: true};
      const updateDoc = {
        $set: {
          status,
          reason
        },
      };

      const result = await classesCollection.updateOne(filter, updateDoc, options);
      res.send(result)
    })

    //update class details
    app.put('/classes/:id/update', async (req, res) => {
      const id = req.params.id;
      const updateClass = req.body;
      const filter = {
        _id: new ObjectId(id)
      };
      const options = { upsert: true};
      const updateDoc = {
        $set: updateClass,
      };

      const result = await classesCollection.updateOne(filter, updateDoc, options);
      res.send(result)
    })

    // delete class
    app.delete('/classes/:id', async (req, res) => {
      const id = req.params.id;
      const filter = {
        _id: new ObjectId(id)
      };
      const result = await classesCollection.deleteOne(filter);
      res.send(result)
    })





    /** 
     * Cart section
      */
    // create cart
    app.post('/carts', async (req, res) => {
      const newItem = req.body;
      const result = await cartsCollection.insertOne(newItem);
      res.send(result);
    })  

    // get all the carts
    app.get('/carts', async (_, res) => {
      // projection: specify which fields to return
      // const  projection = { classId: 1 }
      // sort: sort returned data
      // const sort = {
      //   name: 1
      // }
      const result = await cartsCollection.find()
                              // .project(projection)
                              // .sort(sort)
                              .toArray();
      res.send(result);
    })

    // get single cart
    app.get('/carts/:id', async (req, res) => {
      const id = req.params.id;
      const query = {
        _id: new ObjectId(id)
      };
      const result = await cartsCollection.findOne(query);
      res.send(result);
    })

    //get classes in the cart
    app.get('/carts/:email/classes', async (req, res) => {
      const email = req.params.email;
      const query = { usinstructorEmailerMail: email };
      const projection = { classId: 1};
      const carts = await cartsCollection.find(query).project(projection).toArray();
      const classIds = carts.map(c => new ObjectId(c.classId));
      const query2 = {
        _id: {$in: classIds}
      };
      const result = await classesCollection.find(query2).toArray();
      res.send(result);
    })

    // delete cart
    app.delete('/carts/:id', async (req, res) => {
      const id = req.params.id;
      const filter = {
        _id: new ObjectId(id)
      };
      const result = await usersCollection.deleteOne(filter);
      res.send(result)
    })




    /** 
     * Payment section
      */
    // create payment
    app.post('/payments', async (req, res) => {
      const newItem = req.body;
      const result = await paymentsCollection.insertOne(newItem);
      res.send(result);
    })  





    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  }
  catch(e){
    console.log(e.message);
  } 
  finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
    // console.log("Successfully disconnected to MongoDB!");
  }
}

run().catch(console.dir);
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await client.close();
  console.log('MongoDB connection closed.');
  process.exit(0);
});

app.get('/', (req, res) => {
  res.send('Hello Developer 2024!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
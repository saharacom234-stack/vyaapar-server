const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/vyaapar').then(async () => {
  const users = await mongoose.connection.db.collection('users').find({}).toArray();
  for (const u of users) {
    if (u.logo && u.logo.startsWith('http')) {
      try {
        const path = new URL(u.logo).pathname;
        await mongoose.connection.db.collection('users').updateOne(
          { _id: u._id },
          { $set: { logo: path } }
        );
      } catch (e) {}
    }
  }
  console.log('Fixed DB URLs');
  process.exit(0);
});

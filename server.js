import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/health', (req, res) => {
  res.status(200).send('Server is running');
});

app.get('/load', (req, res) => {
  const randomNumber = Math.floor(Math.random() * 200000000) + 1;

  let count = 0;

  for (let i = 0; i < randomNumber; i++) {
    count += 1;
  }

  res.status(200).send(
    `Work done! Calculated: ${count}`
  );
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

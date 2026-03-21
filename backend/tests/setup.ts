import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

beforeAll(async () => {
  // Give Temporal a moment to be ready
  await new Promise(resolve => setTimeout(resolve, 2000));
});

afterAll(async () => {
  // Cleanup handled by run-tests.sh
});

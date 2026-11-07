import unittest
from check_secret_exposure import env_example_problems, tracked_env_problems


class SecretExposure(unittest.TestCase):
    def test_clean_example(self):
        self.assertEqual(env_example_problems("SESSION_SECRET=replace-with-x\nAPI_PORT=1"), [])

    def test_browser_prefixed_secret_rejected(self):
        self.assertTrue(env_example_problems("VITE_SESSION_SECRET=abc"))
        self.assertTrue(env_example_problems("VITE_DATABASE_URL=x"))

    def test_real_looking_secret_rejected(self):
        self.assertTrue(env_example_problems("SESSION_SECRET=9f8a7b6c5d4e3f2a1b0c"))

    def test_tracked_env_rejected(self):
        self.assertTrue(tracked_env_problems([".env", "a/.env.production"]))
        self.assertFalse(tracked_env_problems([".env.example"]))


if __name__ == "__main__":
    unittest.main()

import app from "./app/app.js";

import dotenv from 'dotenv';
import { startIdleReaper } from "./services/activity.service.js";

dotenv.config();

await startIdleReaper()

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
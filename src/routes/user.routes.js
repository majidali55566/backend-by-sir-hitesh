import { Router } from "express";
import {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeUserPassword,
  getCurrentUser,
  updateUserCoverImage,
  updateUserAvatar,
  updateAccountDetails,
  getUserProfile,
  getUserWatchHistory,
} from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { varifyJWT } from "../middlewares/auth.middleware.js";
const router = Router();

router.route("/register").post(
  upload.fields([
    { name: "avatar", maxCount: 1 },
    {
      name: "coverImage",
      maxCount: 1,
    },
  ]),
  registerUser
);

router.route("/login").post(loginUser);
//secure routes
router.route("/logout").post(varifyJWT, logoutUser);
router.route("/refresh-token").post(refreshAccessToken);
router.route("/change-password").post(varifyJWT, changeUserPassword);
router.route("/current-user").get(varifyJWT, getCurrentUser);
router
  .route("/update-cover-image")
  .post(varifyJWT, upload.single("coverImage"), updateUserCoverImage);
router
  .route("/update-avatar")
  .patch(varifyJWT, upload.single("avatar"), updateUserAvatar);

router.route("/profile/:userName").get(varifyJWT, getUserProfile);
router.route("/update-account-details").patch(varifyJWT, updateAccountDetails);
router.route("/history").get(varifyJWT, getUserWatchHistory);

export default router;

import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadToCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler(async (req, res) => {
  const { userName, email, fullName, password } = req.body;

  if (
    [userName, email, fullName, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required!");
  }

  const existedUser = await User.findOne({ $or: [{ userName }, { email }] });

  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists");
  }
  const avatarLocalPath = req.files?.avatar[0]?.path;
  // const coverImageLocalPath = req.files?.coverImage[0]?.path;
  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }
  console.log("Avatar local Path" + avatarLocalPath);
  console.log("Cover Image Local Path" + coverImageLocalPath);

  if (!avatarLocalPath) throw new ApiError(400, "Avatar file is required");

  const avatar = await uploadToCloudinary(avatarLocalPath);
  const coverImage = await uploadToCloudinary(coverImageLocalPath);

  if (!avatar) throw new ApiError(400, "Avatar file is required");

  const user = await User.create({
    userName: userName.toLowerCase(),
    fullName,
    password,
    email,
    avatar: avatar.url,
    coverImage: coverImage?.url,
  });

  const userCreated = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!userCreated)
    throw new ApiError(500, "Something went wrong while registering the user");

  res.status(201).json(new ApiResponse(200, user));
});

export { registerUser };

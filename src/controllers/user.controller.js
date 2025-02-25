import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadToCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

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

const generateAccessTokenAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const refreshToken = user.generateRefreshToken();
    const accessToken = user.generateAccessToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { refreshToken, accessToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while creating Access and Refresh tokens!"
    );
  }
};

const loginUser = asyncHandler(async (req, res) => {
  const { password, userName, email } = req.body;

  if (!userName && !email)
    throw new ApiError(400, "user name or email is required");

  const UserFounded = await User.findOne({
    $or: [{ email }, { userName }],
  });

  if (!UserFounded) throw new ApiError(404, "User doesn't exist!");

  const isPasswordValid = await UserFounded.isPasswordCorrect(password);
  if (!isPasswordValid) throw new ApiError(401, "Invalid user credentials");

  const { refreshToken, accessToken } =
    await generateAccessTokenAndRefreshToken(UserFounded._id);

  const loggedInUser = await User.findById(UserFounded._id).select(
    "-password -refreshToken"
  );
  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User loggedIn successfully!"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: { refreshToken: undefined },
    },
    { new: true }
  );
  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User Logged out"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) throw new ApiError(401, "Unauthorized request");

  console.log(incomingRefreshToken);
  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);
    if (!user) throw new ApiError(401, "Invalid refresh token");

    if (incomingRefreshToken !== user.refreshToken)
      throw new ApiError(401, "refreshtoken is expired or used!");

    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken, refreshToken: newRefreshToken } =
      await generateAccessTokenAndRefreshToken(user._id);
    console.log(newRefreshToken);
    res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          {
            accessToken,
            refreshToken: newRefreshToken,
          },
          "access token refreshed successfully"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message);
  }
});

const changeUserPassword = asyncHandler(async (req, res) => {
  const { newPassword, oldPassword } = req.body;

  const user = await User.findById(req.user?._id);
  const passwordIsCorrect = await user.isPasswordCorrect(oldPassword);

  if (!passwordIsCorrect) throw new ApiError(400, "invalid password");

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  res
    .status(200)
    .json(new ApiResponse(200, {}, "password changed successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  res.status(200).json(200, req.user, "current user fetched successfully");
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;

  if (!fullName || !email) throw new ApiError(400, "All fields are required");

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: { email, fullName },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(
      new ApiResponse(200, { user }, "Account details updated successfully")
    );
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;
  if (!avatarLocalPath) throw new ApiError(404, "Avatar file is missing!");
  const uploadedToCloudinary = await uploadToCloudinary(avatarLocalPath);
  if (!uploadedToCloudinary?.url)
    throw new ApiError(400, "Error while uploading to cloudinary");

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: { avatar: uploadedToCloudinary.url },
    },
    { new: true }
  ).select("-password");

  res
    .status(200)
    .json(new ApiResponse(200, { user }, "Avatar updated successfully"));
});
const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;
  if (!coverImageLocalPath)
    throw new ApiError(404, "cover image file is missing!");
  const uploadedToCloudinary = await uploadToCloudinary(coverImageLocalPath);
  if (!uploadedToCloudinary?.url)
    throw new ApiError(400, "Error while uploading to cloudinary");

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: { coverImage: uploadedToCloudinary.url },
    },
    { new: true }
  ).select("-password");

  res
    .status(200)
    .json(new ApiResponse(200, { user }, "CoverImage updated successfully"));
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeUserPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
};

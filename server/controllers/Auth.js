const OTP = require("../models/OTP");
const User = require("../models/User");
const otpGenerator = require("otp-generator")
const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
const Profile = require("../models/Profile")
const mailSender = require("../utils/mailSender")
const { passwordUpdated } = require("../mail/templates/passwordUpdate")
// const { otpTemplate } = require("../mail/templates/emailVerificationTemplate")
require("dotenv").config();

// 1.... send OTP
exports.sendOTP = async (req, res) => {
  try {
    //fetch email from request ki body
    const { email } = req.body;
 
    //check if user already exist
    const checkUserPresent = await User.findOne({ email });

    //if user already exist,  then return a response
   if(checkUserPresent){
    return res.status(401).json({
        success: false,
        message: "User Already registered.",
      });
   }

    //genreate otp
     let otp = otpGenerator.generate(6, {
        upperCaseAlphabets: false,
        lowerCaseAlphabets: false,
        specialChars: false
     });
    //  console.log("OTP Generated: ", otp);

     //check unique otp or not
     let result = await OTP.findOne({otp: otp});

     while(result){
        otp = otpGenerator(6,{
            upperCaseAlphabets: false,
            lowerCaseAlphabets: false,
            specialChars: false
        });
        result = await OTP.findOne({otp: otp});
     }

     const otpPayload = {email,otp};

     //create an entry for OTP
     const otpBody = await OTP.create(otpPayload);
     console.log(otpBody);

     // return response successfully
     res.status(200).json({
        success: true,
        message: "OTP send Successfully.",
        otp
     })

  }catch (error) {
      console.log(error);
      return res.status(500).json({
        success: false,
        message: error.message,
      })
  } 
};

//2.... signup
  exports.signUp = async(req,res) =>{
    try{
        // fetch data from request ki body
        const {
            firstName,
            lastName,
            email,
            password,
            confirmPassword,
            accountType,
            contactNumber,
            otp
        } = req.body;
        //validate data
        if(!firstName || !lastName || !email || !password || !confirmPassword || !otp){
            return res.status(403).json({
                success: false,
                message: "All Field Are required"
            })
        }
        //match both password
        if(password !== confirmPassword){
            return res.status(400).json({
                success: false,
                message: "Password and ConfirmPasword value does not match, please try again."
            });
        }
        //check user already exist or not
        const existingUser = await User.findOne({email});
        if(existingUser){
            return res.status(400).json({ 
                success: false,
                message: "User is already registered"
            });
        }

        //find most recent OTP stored for the user 
        const response = await OTP.find({ email }).sort({ createdAt: -1 }).limit(1)
        // console.log(response)
        if (response.length === 0) {  
          // OTP not found for the email
          return res.status(400).json({
            success: false,
            message: "The OTP is not valid",
          })
        }if (otp !== response[0].otp) {
            // Invalid OTP
            return res.status(400).json({
              success: false,
              message: "Invalid OTP",
            });
            // console.log("OTP from request:", otp);
            // console.log("OTP from database:", response[0].otp); 
          }


        //Hash password
         const hashPassword = await bcrypt.hash(password,10);
        //create entry in DB
         
        const profileDetails = await Profile.create({
            gender:null,
            dateOfBirth:null,
            about:null,
            contactNumber:null
        });

        const user = await User.create({
            firstName,
            lastName,
            email,
            contactNumber,
            password:hashPassword,
            confirmPassword: hashPassword,
            accountType,
            additionalDetails:profileDetails._id,
            image: `https://api.dicebear.com/5.x/initials/svg?seed=${firstName} ${lastName}`,
        })
        //return res
        res.status(200).json({
            success: true,
            message: "User is Regiserted Successfully.",
            user
        });
    }catch(error){
        console.log(error);
      return res.status(500).json({
        success: false,
        message: "User cannot be registered, Please try again",
      });
    } 
  }

//3... login
exports.login = async(req,res) => {
    try{
       //fetch the data from req ki body
       const {email,password} = req.body;
       //validation data
       if(!email || !password){
        return res.status(403).json({
            success: false,
            message: "All fields are required, Please try again"
        });
       }
       //user check exist or not
       const user = await User.findOne({email});
       if(!user){
        return res.status(401).json({
            success:false,
            message: "User is not reistered, please signup first",
        });
       }
       //generate JWT, after password matching
       if(await bcrypt.compare(password, user.password)){
         const payload = {
            email: user.email,
            id: user._id,
            accountType: user.accountType
         }
          const token = jwt.sign(payload, process.env.JWT_SECRET, {
            expiresIn: "2h"
          });
          user.token = token;
          user.password = undefined;
       
       //create cookie and send response
       const options = {
          expires: new Date(Date.now() + 3*24*60*60*60*1000),
          httpOnly: true
       } 
       res.cookie("token", token, options).status(200).json({
        success:true,
        token,
        user,
        message: "Logged In Successfully"
       });
    }
    else{
        return res.status(401).json({
            success:false,
            message: "Password is Incorrect"
        });
    }
    }catch(error){
        console.log(error);
        return res.status(500).json({
            success:false,
            message: "Login Failure, please try again "
        });
    }
}

//4... Controller for Changing Password
exports.changePassword = async (req, res) => {
    try {
      // Get user data from req.user
      const userDetails = await User.findById(req.user.id)
  
      // Get old password, new password, and confirm new password from req.body
      const { oldPassword, newPassword } = req.body
  
      // Validate old password
      const isPasswordMatch = await bcrypt.compare(
        oldPassword,
        userDetails.password
      )
      if (!isPasswordMatch) {
        // If old password does not match, return a 401 (Unauthorized) error
        return res
          .status(401)
          .json({ success: false, message: "The password is incorrect" })
      }
  
      // Update password
      const encryptedPassword = await bcrypt.hash(newPassword, 10)
      const updatedUserDetails = await User.findByIdAndUpdate(
        req.user.id,
        { password: encryptedPassword },
        { new: true }
      )
  
      // Send notification email
      try {
        const emailResponse = await mailSender(
          updatedUserDetails.email,
          "Password for your account has been updated",
          passwordUpdated(
            updatedUserDetails.email,
            `Password updated successfully for ${updatedUserDetails.firstName} ${updatedUserDetails.lastName}`
          )
        )
        console.log("Email sent successfully:", emailResponse.response)
      } catch (error) {
        // If there's an error sending the email, log the error and return a 500 (Internal Server Error) error
        console.error("Error occurred while sending email:", error)
        return res.status(500).json({
          success: false,
          message: "Error occurred while sending email",
          error: error.message,
        })
      }
  
      // Return success response
      return res
        .status(200)
        .json({ success: true, message: "Password updated successfully" })
    } catch (error) {
      // If there's an error updating the password, log the error and return a 500 (Internal Server Error) error
      console.error("Error occurred while updating password:", error)
      return res.status(500).json({
        success: false,
        message: "Error occurred while updating password",
        error: error.message,
      })
    }
  }
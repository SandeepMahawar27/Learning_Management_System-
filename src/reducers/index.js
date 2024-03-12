import { combineReducers } from "@reduxjs/toolkit";
import authReducer from "../slice/authSlice"
import profileReducer from "../slice/ProfileSlice"
import cartReducers from "../slice/CartSlice"
import courseReducer from "../slice/CourseSlice"
import viewCourseReducer from "../slice/viewCourseSlice";

const rootReducer = combineReducers({
    auth: authReducer,
    profile: profileReducer,
    cart: cartReducers,
    course: courseReducer,
    viewCourse: viewCourseReducer
});

export default rootReducer 
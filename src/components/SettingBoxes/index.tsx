"use client";

import {
  CallIcon,
  EmailIcon,
  PencilSquareIcon,
  UploadIcon,
  UserIcon,
} from "@/assets/icons";
import Image from "next/image";
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import Cookies from "js-cookie";
import { useAuth } from "../../../contexts/AuthContext";
import { jwtDecode } from "jwt-decode";
import { getErrorMessage } from "@/lib/apiErrors";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

interface User {
  id: number;
  full_name: string;
  email: string | null;
  username: string;
  cnic: string | null;
  phone: string | null;
  role_id: number;
  role: string;
  device_id: string | null;
  image?: string | null;
  coverImage?: string | null;
  bio?: string | null;
  permissions: any[];
}

export default function SettingBoxes() {
  const { user, loading: authLoading, setUser } = useAuth();

  const [data, setData] = useState({
    full_name: "",
    email: "",
    phone: "",
    bio: "",
    profilePhoto: "/images/user/user-03.png",
  });

  const [fileProfile, setFileProfile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setData({
        full_name: user.full_name || "",
        email: user.email || "",
        phone: user.phone || "",
        bio: user.bio || "",
        profilePhoto: user.image || "/images/user/user-03.png",
      });
    }
  }, [user]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    if (name === "profilePhoto" && "files" in e.target && e.target.files?.[0]) {
      const file = e.target.files[0];
      setData((prev) => ({ ...prev, profilePhoto: URL.createObjectURL(file) }));
      setFileProfile(file);
    } else {
      setData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const token = Cookies.get("auth_token");
    if (!token) return toast.error("Authentication required");

    setSaving(true);
    const formData = new FormData();
    formData.append("full_name", data.full_name);
    formData.append("email", data.email);
    formData.append("phone", data.phone);
    formData.append("bio", data.bio);
    if (fileProfile) formData.append("image", fileProfile);

    try {
      const res = await fetch(`${BACKEND_URL}/api/user/update`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (res.ok) {
        const result = await res.json();

      if (result.token) {
        Cookies.set("auth_token", result.token, { expires: 30, path: "/" });
        const decoded = jwtDecode<User>(result.token);
        setUser(decoded);
      }
        toast.success("Settings updated successfully");
      } else {
        toast.error("Failed to update settings");
      }
    } catch (err) {
      toast.error(getErrorMessage(err, "An error occurred"));
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) return <div className="text-center py-10">Loading...</div>;

  return (
    <div className="grid grid-cols-5 gap-8">
      <div className="col-span-5 xl:col-span-3">
        <div className="rounded-[10px] border border-stroke bg-white shadow-1 dark:border-dark-3 dark:bg-gray-dark">
          <div className="border-b border-stroke px-7 py-4 dark:border-dark-3">
            <h3 className="font-medium text-dark dark:text-white">Personal Information</h3>
          </div>
          <div className="p-7">
            <form onSubmit={handleSubmit}>
              {/* Full Name & Phone */}
              <div className="mb-5.5 flex flex-col gap-5.5 sm:flex-row">
                <div className="w-full sm:w-1/2">
                  <label className="mb-3 block text-body-sm font-medium text-dark dark:text-white">
                    Full Name
                  </label>
                  <div className="relative">
                    <span className="absolute left-4.5 top-1/2 -translate-y-1/2">
                      <UserIcon />
                    </span>
                    <input
                      type="text"
                      name="full_name"
                      value={data.full_name}
                      onChange={handleChange}
                      className="w-full rounded-lg border-[1.5px] border-stroke bg-white py-2.5 pl-12.5 pr-4.5 text-dark bg-transparent outline-none transition focus:border-[#ff3d3d]"
                    />
                  </div>
                </div>
                <div className="w-full sm:w-1/2">
                  <label className="mb-3 block text-body-sm font-medium text-dark dark:text-white">
                    Phone Number
                  </label>
                  <div className="relative">
                    <span className="absolute left-4.5 top-1/2 -translate-y-1/2">
                      <CallIcon />
                    </span>
                    <input
                      type="text"
                      name="phone"
                      value={data.phone}
                      onChange={handleChange}
                      className="w-full rounded-lg border-[1.5px] border-stroke bg-white py-2.5 pl-12.5 pr-4.5 text-dark bg-transparent outline-none transition focus:border-[#ff3d3d]"
                    />
                  </div>
                </div>
              </div>

              {/* Email */}
              <div className="mb-5.5">
                <label className="mb-3 block text-body-sm font-medium text-dark dark:text-white">
                  Email Address
                </label>
                <div className="relative">
                  <span className="absolute left-4.5 top-1/2 -translate-y-1/2">
                    <EmailIcon />
                  </span>
                  <input
                    type="email"
                    name="email"
                    value={data.email}
                    onChange={handleChange}
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-white py-2.5 pl-12.5 pr-4.5 text-dark bg-transparent outline-none transition focus:border-[#ff3d3d]"
                  />
                </div>
              </div>

              {/* Bio */}
              <div className="mb-5.5">
                <label className="mb-3 block text-body-sm font-medium text-dark dark:text-white">BIO</label>
                <div className="relative">
                  <span className="absolute left-5 top-5.5">
                    <PencilSquareIcon width={20} height={20} />
                  </span>
                  <textarea
                    name="bio"
                    rows={6}
                    value={data.bio}
                    onChange={handleChange}
                    placeholder="Write your bio here"
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-white py-5 pl-13 pr-5 text-dark bg-transparent outline-none transition focus:border-[#ff3d3d]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  className="rounded-lg border border-stroke px-6 py-[7px] font-medium text-dark hover:shadow-1 dark:border-dark-3"
                  onClick={() => {
                    if (user) {
                      setData({
                        full_name: user.full_name || "",
                        email: user.email || "",
                        phone: user.phone || "",
                        bio: user.bio || "",
                        profilePhoto: user.image || "/images/user/user-03.png",
                      });
                    }
                  }} 
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-[#ff3d3d] px-6 py-[7px] font-medium text-white hover:bg-opacity-90 disabled:opacity-70"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Profile Photo */}
      <div className="col-span-5 xl:col-span-2">
        <div className="rounded-[10px] border border-stroke bg-white shadow-1 dark:border-dark-3 dark:bg-gray-dark">
          <div className="border-b border-stroke px-7 py-4 dark:border-dark-3">
            <h3 className="font-medium text-dark dark:text-white">Your Photo</h3>
          </div>
          <div className="p-7">
            <div className="mb-4 flex items-center gap-3">
              <Image
                src={data.profilePhoto}
                width={55}
                height={55}
                alt="User"
                className="size-14 rounded-full object-cover"
              />
              <div>
                <span className="mb-1.5 font-medium text-dark dark:text-white block">
                  Edit your photo
                </span>
              </div>
            </div>
            <div className="relative mb-5.5 block w-full cursor-pointer appearance-none rounded-xl border border-dashed border-gray-4 bg-gray-2 px-4 py-7.5 hover:border-[#ff3d3d] dark:border-dark-3 dark:bg-dark-2">
              <input
                type="file"
                name="profilePhoto"
                onChange={handleChange}
                accept="image/png, image/jpg, image/jpeg"
                className="absolute inset-0 z-50 m-0 h-full w-full cursor-pointer p-0 opacity-0 outline-none"
              />
              <div className="flex flex-col items-center justify-center">
                <div className="flex h-13.5 w-13.5 items-center justify-center rounded-full border border-stroke bg-white dark:border-dark-3 dark:bg-gray-dark">
                  <UploadIcon />
                </div>
                <p className="mt-2.5 text-body-sm font-medium">
                  <span className="text-[#ff3d3d]">Click to upload</span> or drag and drop
                </p>
                <p className="mt-1 text-body-xs">PNG, JPG or JPEG (max 800x800px)</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
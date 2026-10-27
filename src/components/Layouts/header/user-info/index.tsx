"use client";

import { ChevronUpIcon } from "@/assets/icons";
import {
  Dropdown,
  DropdownContent,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LogOutIcon, SettingsIcon, UserIcon } from "./icons";
import Cookies from "js-cookie";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../../../contexts/AuthContext";

export function UserInfo() {
  const [isOpen, setIsOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const previewRef = useRef<HTMLDialogElement>(null);
  const avatarButtonRef = useRef<HTMLButtonElement>(null);
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const router = useRouter();
  const { user, loading } = useAuth();

  const USER = {
    name: user?.full_name || "John Smith",
    email: user?.email || "johnson@nextadmin.com",
    img: user?.image || "/images/user/user-03.png",
  };
  const avatarSrc =
    failedImage === USER.img ? "/images/user/user-03.png" : USER.img;

  useEffect(() => {
    if (!isPreviewOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Let the account menu finish restoring focus before opening the dialog.
    const timer = window.setTimeout(() => previewRef.current?.showModal(), 0);
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
    };
  }, [isPreviewOpen]);

  const openPreview = () => {
    setIsOpen(false);
    setIsPreviewOpen(true);
  };

  const handleLogout = () => {
    Cookies.remove("auth_token");
    router.push("/login");
  };

  return (
    <>
      <div className="flex items-center gap-3">
        <button
          ref={avatarButtonRef}
          type="button"
          onClick={openPreview}
          disabled={loading}
          aria-label={`View full profile image of ${USER.name}`}
          className="shrink-0 cursor-zoom-in rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          {loading ? (
            <span className="block size-12 animate-pulse rounded-full bg-gray-2" />
          ) : (
            <Image
              src={avatarSrc}
              onError={() => setFailedImage(USER.img)}
              className="size-12 rounded-full object-cover"
              alt={`Avatar of ${USER.name}`}
              width={200}
              height={200}
            />
          )}
        </button>
        <Dropdown isOpen={isOpen} setIsOpen={setIsOpen}>
          <DropdownTrigger className="rounded align-middle outline-none ring-primary ring-offset-2 focus-visible:ring-1 dark:ring-offset-gray-dark">
            <span className="sr-only">My Account</span>

            <figure className="flex items-center gap-3">
              <figcaption className="flex items-center gap-1 font-medium text-dark dark:text-dark-6">
                <span className="max-[1024px]:sr-only">{USER.name}</span>

                <ChevronUpIcon
                  aria-hidden
                  className={cn(
                    "rotate-180 transition-transform",
                    isOpen && "rotate-0",
                  )}
                  strokeWidth={1.5}
                />
              </figcaption>
            </figure>
          </DropdownTrigger>

          <DropdownContent
            className="border border-stroke bg-white shadow-md dark:border-dark-3 dark:bg-gray-dark min-[230px]:min-w-[17.5rem]"
            align="end"
          >
            <h2 className="sr-only">User information</h2>

            <figure className="flex items-center gap-2.5 px-5 py-3.5">
              <button
                type="button"
                onClick={openPreview}
                disabled={loading}
                aria-label={`View full profile image of ${USER.name}`}
                className="shrink-0 cursor-zoom-in rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              >
                {loading ? (
                  <span className="size-12 animate-pulse rounded-full bg-gray-2" />
                ) : (
                  <Image
                    src={avatarSrc}
                    onError={() => setFailedImage(USER.img)}
                    className="size-12 rounded-full object-cover"
                    alt={`Avatar for ${USER.name}`}
                    role="presentation"
                    width={200}
                    height={200}
                  />
                )}
              </button>

              <figcaption className="space-y-1 text-base font-medium">
                <div className="mb-2 leading-none text-dark dark:text-white">
                  {USER.name}
                </div>

                <div className="leading-none text-gray-6">{USER.email}</div>
              </figcaption>
            </figure>

            <hr className="border-[#E8E8E8] dark:border-dark-3" />

            <div className="p-2 text-base text-[#4B5563] dark:text-dark-6 [&>*]:cursor-pointer">
              <Link
                href={"/profile"}
                onClick={() => setIsOpen(false)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[9px] hover:bg-gray-2 hover:text-dark dark:hover:bg-dark-3 dark:hover:text-white"
              >
                <UserIcon />

                <span className="mr-auto text-base font-medium">
                  View profile
                </span>
              </Link>

              <Link
                href={"/settings"}
                onClick={() => setIsOpen(false)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[9px] hover:bg-gray-2 hover:text-dark dark:hover:bg-dark-3 dark:hover:text-white"
              >
                <SettingsIcon />

                <span className="mr-auto text-base font-medium">
                  Account Settings
                </span>
              </Link>
            </div>

            <hr className="border-[#E8E8E8] dark:border-dark-3" />

            <div className="p-2 text-base text-[#4B5563] dark:text-dark-6">
              <button
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[9px] hover:bg-gray-2 hover:text-dark dark:hover:bg-dark-3 dark:hover:text-white"
                onClick={() => {
                  setIsOpen(false);
                  handleLogout();
                }}
              >
                <LogOutIcon />

                <span className="text-base font-medium">Log out</span>
              </button>
            </div>
          </DropdownContent>
        </Dropdown>
      </div>
      <dialog
        ref={previewRef}
        aria-label={`Profile image of ${USER.name}`}
        className="pointer-events-auto fixed inset-0 m-auto h-[100dvh] max-h-none w-screen max-w-none border-0 bg-transparent p-4 backdrop:bg-black/80 open:flex open:items-center open:justify-center"
        onClick={(event) => {
          if (event.target === event.currentTarget) previewRef.current?.close();
        }}
        onClose={() => {
          setIsPreviewOpen(false);
          avatarButtonRef.current?.focus();
        }}
      >
        <button
          type="button"
          autoFocus
          aria-label="Close image preview"
          onClick={() => previewRef.current?.close()}
          className="absolute right-4 top-4 flex size-11 items-center justify-center rounded-full bg-black/60 text-3xl text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
        >
          <span aria-hidden="true">×</span>
        </button>
        {isPreviewOpen && (
          <Image
            src={avatarSrc}
            onError={() => setFailedImage(USER.img)}
            alt={`Full profile image of ${USER.name}`}
            width={1600}
            height={1600}
            unoptimized
            className="h-auto max-h-[85dvh] w-auto max-w-full object-contain"
          />
        )}
      </dialog>
    </>
  );
}

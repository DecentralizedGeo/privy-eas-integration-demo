# Configuring Apps through the Privy Dashboard

The following guide explains how to set up and manage your Privy application through the [privy dashboard](https://dashboard.privy.io/). This includes creating your app, configuring authentication methods, and managing environment variables.

## 🛠️ Setting Up Your Privy App

If you haven't already created a Privy developer account, start by signing up at [https://dashboard.privy.io/](https://dashboard.privy.io/). Once signed up, follow these steps to create and configure your application:

1. Create a New Application:
   - Log in to the Privy dashboard.
   - Click on "Create New App".
   - Provide a name and description for your app, then click "Create".

    You should now see your newly created application configuration home page.

2. Expand `Configuration` in the sidebar, and click `App Settings`.
  
    Under `Basics` and in the `API Keys` section, you will find your `App ID` and `App Secret`. Take note of `App ID` as they will be needed for your application's environment variables. If they do not exist, you can create a new `App Secret` by clicking the `New Secret` button.
  
3. Expand `Wallet infrastructure` in the sidebar, and click `Smart Wallets`.
  
    Here you will need to enable the option `Enable smart wallets for your app`. In `Configure chains` select the chains you want to support for your app (e.g., Ethereum Mainnet, Celo, Arbitrum, etc.). Make sure to save your changes.

4. Expand `User Management` in the sidebar, and click `Authentication`.
  
    Here you can enable the authentication methods you want to support for your app (e.g., Email, Google, MetaMask, etc.). Enabling `Email` will allow users to sign up and log in using their email addresses. In order for users create wallets upon registration, make sure to enable `Automatically create embedded wallets on login` and select `EVM Wallets` so that Ethereum-compatible embedded wallets are created.

    Enable `Extnernal wallets` to allow users to connect with wallets like MetaMask. Make sure to check off `Ethereum wallets` to support Ethereum-based wallets.

    Next, go to the `Advanced` tab and (*optionally*) enable the following:

    - `Login method transfer`: Enables users to switch between login methods (e.g., from email to MetaMask) while retaining their account data.
    - `Reuturn user data in an identity token`: Allows your app to receive user profile data in the identity token after login. This is useful for debugging.
    - `Test Accounts`: Highly recommended for development. This allows you to create test user accounts without by using the provided OTP codes.
    - `Disable confirmation modals (reac-auth only)`: Disables confirmation modals in the React Auth SDK for a smoother user experience during development.

## 🔧 Environment Variables

To connect your application to Privy, you need to set up the following environment variables in your development and production environments.

### Client-side Variables (VITE_* prefix) to `.env.vite` file

VITE_PRIVY_APP_ID=<your_privy_app_id>

### Local Server-side Variables (No VITE_ prefix) to `.env` file

PRIVY_APP_SECRET=<your_privy_app_secret>

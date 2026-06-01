// backend/src/services/outsetaApi.js
const axios = require("axios");
const Config = require("../../config");

class OutsetaApiService {
  constructor() {
    this.baseURL =
      Config.outseta?.apiUrl || "https://ltcflow.outseta.com/api/v1";
    this.apiKey = Config.outseta?.apiKey;
    this.secretKey = Config.outseta?.secretKey;

    // Create axios instance with Outseta's custom auth format
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        "Content-Type": "application/json",
        // Use Outseta's custom authorization format
        Authorization: `Outseta ${this.apiKey}:${this.secretKey}`,
      },
    });
  }

  // Check if Outseta is configured
  isConfigured() {
    return !!(this.apiKey && this.secretKey);
  }

  // Update an account in Outseta
  async updateAccount(outsetaAccountId, accountData) {
    if (!this.isConfigured() || !outsetaAccountId) {
      console.warn(
        "Outseta not configured or no account ID - skipping account update"
      );
      return null;
    }

    try {
      console.log(`🔄 Updating account in Outseta: ${outsetaAccountId}`);

      const response = await this.client.put(
        `/crm/accounts/${outsetaAccountId}`,
        accountData
      );

      console.log(`✅ Account updated in Outseta: ${outsetaAccountId}`);

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error(
        "❌ Failed to update account in Outseta:",
        error.response?.data || error.message
      );

      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }
  // Add these methods to your outsetaApi.js service:

  // Replace your createPersonAccount method with these corrected approaches:

  // Method 1: Create person with PersonAccount relationship from the start
  async createPersonWithAccount(userData, companyData) {
    if (!this.isConfigured()) {
      console.warn("Outseta not configured - skipping person creation");
      return null;
    }

    try {
      // Create person with PersonAccount relationship included
      const personData = {
        Email: userData.email,
        FirstName: userData.firstName,
        LastName: userData.lastName,
        Phone: userData.phone || null,
        // Include PersonAccount during creation
        PersonAccount: companyData.outsetaAccountId
          ? [
              {
                Account: {
                  Uid: companyData.outsetaAccountId,
                },
                IsPrimary: false,
              },
            ]
          : [],
      };

      console.log(
        `🔄 Creating person with account association: ${userData.email}`
      );

      const response = await this.client.post("/crm/people", personData);

      console.log(
        `✅ Person created with account association: ${userData.email} [${response.data.Uid}]`
      );

      return {
        success: true,
        personId: response.data.Uid,
        data: response.data,
      };
    } catch (error) {
      console.error(
        "❌ Failed to create person with account:",
        error.response?.data || error.message
      );

      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  // Method 2: Link existing person to account by updating the person
  async linkPersonToAccount(
    outsetaPersonId,
    outsetaAccountId,
    isPrimary = false
  ) {
    if (!this.isConfigured() || !outsetaPersonId || !outsetaAccountId) {
      console.warn(
        "Outseta not configured or missing IDs - skipping person-account link"
      );
      return null;
    }

    try {
      console.log(
        `🔄 Linking person to account: ${outsetaPersonId} -> ${outsetaAccountId}`
      );

      // First, get the current person data
      const currentPersonResponse = await this.client.get(
        `/crm/people/${outsetaPersonId}`
      );
      const currentPerson = currentPersonResponse.data;

      // Prepare the update with PersonAccount relationship
      const updateData = {
        Email: currentPerson.Email,
        FirstName: currentPerson.FirstName,
        LastName: currentPerson.LastName,
        Phone: currentPerson.Phone,
        // Add or update PersonAccount relationships
        PersonAccount: [
          {
            Account: {
              Uid: outsetaAccountId,
            },
            IsPrimary: isPrimary,
          },
        ],
      };

      const response = await this.client.put(
        `/crm/people/${outsetaPersonId}`,
        updateData
      );

      console.log(
        `✅ Person linked to account: ${outsetaPersonId} -> ${outsetaAccountId}`
      );

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error(
        "❌ Failed to link person to account:",
        error.response?.data || error.message
      );

      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  // Method 3: Alternative approach - update account to include person
  async addPersonToAccountTeam(outsetaPersonId, outsetaAccountId) {
    if (!this.isConfigured() || !outsetaPersonId || !outsetaAccountId) {
      console.warn("Outseta not configured or missing IDs");
      return null;
    }

    try {
      console.log(
        `🔄 Adding person to account team: ${outsetaPersonId} -> ${outsetaAccountId}`
      );

      // Get current account data with PersonAccount relationships
      const accountResponse = await this.client.get(
        `/crm/accounts/${outsetaAccountId}?fields=*,PersonAccount.*,PersonAccount.Person.*`
      );
      const currentAccount = accountResponse.data;

      // Add new person to existing PersonAccount array
      const existingPersonAccounts = currentAccount.PersonAccount || [];
      const personExists = existingPersonAccounts.some(
        (pa) => pa.Person.Uid === outsetaPersonId
      );

      if (personExists) {
        console.log(
          `Person ${outsetaPersonId} already associated with account ${outsetaAccountId}`
        );
        return {
          success: true,
          message: "Person already associated with account",
        };
      }

      // Add new PersonAccount relationship
      const updatedPersonAccounts = [
        ...existingPersonAccounts,
        {
          Person: { Uid: outsetaPersonId },
          Account: { Uid: outsetaAccountId },
          IsPrimary: existingPersonAccounts.length === 0, // First person is primary
        },
      ];

      const updateData = {
        Name: currentAccount.Name,
        PersonAccount: updatedPersonAccounts,
      };

      const response = await this.client.put(
        `/crm/accounts/${outsetaAccountId}`,
        updateData
      );

      console.log(
        `✅ Person added to account team: ${outsetaPersonId} -> ${outsetaAccountId}`
      );

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error(
        "❌ Failed to add person to account team:",
        error.response?.data || error.message
      );

      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  // Create a person in Outseta
  async createPerson(userData, companyData) {
    if (!this.isConfigured()) {
      console.warn("Outseta not configured - skipping person creation");
      return null;
    }

    try {
      const personData = {
        Email: userData.email,
        FirstName: userData.firstName,
        LastName: userData.lastName,
        Phone: userData.phone || null,
        // Link to the account (company)
        Account: companyData.outsetaAccountId
          ? {
              Uid: companyData.outsetaAccountId,
            }
          : null,
      };

      console.log(`🔄 Creating person in Outseta: ${userData.email}`);

      const response = await this.client.post("/crm/people", personData);

      console.log(
        `✅ Person created in Outseta: ${userData.email} [${response.data.Uid}]`
      );

      return {
        success: true,
        personId: response.data.Uid,
        data: response.data,
      };
    } catch (error) {
      console.error(
        "❌ Failed to create person in Outseta:",
        error.response?.data || error.message
      );

      // Don't throw error - user creation should continue even if Outseta fails
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  // Update a person in Outseta
  async updatePerson(outsetaPersonId, personData) {
    if (!this.isConfigured() || !outsetaPersonId) {
      console.warn(
        "Outseta not configured or no person ID - skipping person update"
      );
      return null;
    }

    try {
      console.log(`🔄 Updating person in Outseta: ${outsetaPersonId}`);

      const response = await this.client.put(
        `/crm/people/${outsetaPersonId}`,
        personData
      );

      console.log(`✅ Person updated in Outseta: ${outsetaPersonId}`);

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error(
        "❌ Failed to update person in Outseta:",
        error.response?.data || error.message
      );

      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  // Delete a person from Outseta
  async deletePerson(outsetaPersonId) {
    if (!this.isConfigured() || !outsetaPersonId) {
      console.warn(
        "Outseta not configured or no person ID - skipping person deletion"
      );
      return null;
    }

    try {
      console.log(`🔄 Deleting person from Outseta: ${outsetaPersonId}`);

      await this.client.delete(`/crm/people/${outsetaPersonId}`);

      console.log(`✅ Person deleted from Outseta: ${outsetaPersonId}`);

      return {
        success: true,
        message: "Person deleted successfully",
      };
    } catch (error) {
      console.error(
        "❌ Failed to delete person from Outseta:",
        error.response?.data || error.message
      );

      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  // Get person from Outseta by email
  async getPersonByEmail(email) {
    if (!this.isConfigured()) {
      console.warn("Outseta not configured - skipping person lookup");
      return null;
    }

    try {
      console.log(`🔍 Looking up person in Outseta: ${email}`);

      const response = await this.client.get(`/crm/people`, {
        params: {
          Email: email,
        },
      });

      const people = response.data.Items || [];
      const person = people.find(
        (p) => p.Email.toLowerCase() === email.toLowerCase()
      );

      if (person) {
        console.log(`✅ Person found in Outseta: ${email} [${person.Uid}]`);
        return {
          success: true,
          person: person,
        };
      } else {
        console.log(`❌ Person not found in Outseta: ${email}`);
        return {
          success: false,
          error: "Person not found",
        };
      }
    } catch (error) {
      console.error(
        "❌ Failed to lookup person in Outseta:",
        error.response?.data || error.message
      );

      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  // Add person to account (company)
  async addPersonToAccount(outsetaPersonId, outsetaAccountId) {
    if (!this.isConfigured() || !outsetaPersonId || !outsetaAccountId) {
      console.warn(
        "Outseta not configured or missing IDs - skipping person-account link"
      );
      return null;
    }

    try {
      console.log(
        `🔄 Adding person ${outsetaPersonId} to account ${outsetaAccountId} in Outseta`
      );

      // Update person to link to account
      const response = await this.client.put(`/crm/people/${outsetaPersonId}`, {
        Account: {
          Uid: outsetaAccountId,
        },
      });

      console.log(
        `✅ Person added to account in Outseta: ${outsetaPersonId} -> ${outsetaAccountId}`
      );

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error(
        "❌ Failed to add person to account in Outseta:",
        error.response?.data || error.message
      );

      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  // Record usage for a specific account
  async recordUsage(outsetaAccountId, amount = 1) {
    if (!this.isConfigured() || !outsetaAccountId) {
      console.warn(
        "Outseta not configured or missing account ID - skipping usage record"
      );
      return null;
    }

    try {
      const subdomain = this.baseURL.replace("https://", "").split(".")[0];
      const addOnUid = process.env.OUTSETA_ADDON_UID;

      console.log(
        `🔄 Fetching account ${outsetaAccountId} to locate SubscriptionAddOn...`
      );

      // 1️⃣ Fetch the account with current subscription info
      const accountRes = await this.client.get(
        `/crm/accounts/${outsetaAccountId}?fields=Uid,Name,CurrentSubscription.*,CurrentSubscription.SubscriptionAddOns.*,CurrentSubscription.SubscriptionAddOns.AddOn.*`
      );

      const accountData = accountRes.data;
      const addOnSubs =
        accountData?.CurrentSubscription?.SubscriptionAddOns || [];

      // 2️⃣ Find the subscription add-on UID
      const target = addOnSubs.find((sa) => sa.AddOn?.Uid === addOnUid);
      if (!target)
        throw new Error(
          `Add-on ${addOnUid} not found in account ${outsetaAccountId}`
        );

      console.log(`✅ Found SubscriptionAddOn UID: ${target.Uid}`);

      // 3️⃣ Post usage entry
      const payload = {
        UsageDate: new Date().toISOString(),
        Amount: amount,
        SubscriptionAddOn: { Uid: target.Uid },
      };

      console.log(
        `🔄 Recording usage for SubscriptionAddOn ${target.Uid} (${amount} units)`
      );

      const usageRes = await this.client.post(`/billing/usage`, payload);

      console.log(
        `✅ Usage recorded successfully for account ${outsetaAccountId}`
      );

      return {
        success: true,
        data: usageRes.data,
      };
    } catch (error) {
      console.error(
        "❌ Failed to record usage in Outseta:",
        error.response?.data || error.message
      );

      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }
}

// Export singleton instance
module.exports = new OutsetaApiService();

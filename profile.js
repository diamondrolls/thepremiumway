// Supabase Configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://fjtzodjudyctqacunlqp.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseKey) {
  console.error('Supabase key is missing. Please set VITE_SUPABASE_ANON_KEY environment variable.');
}

const { createClient } = supabase;
const client = createClient(supabaseUrl, supabaseKey);

// Constants
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// Helper function to show loading state
function setLoadingState(isLoading, buttonId = 'saveProfileBtn') {
  const btn = document.getElementById(buttonId);
  if (btn) {
    btn.disabled = isLoading;
    btn.textContent = isLoading ? 'Saving...' : 'Save Profile';
  }
}

// Handle logout button
document.getElementById('logout-btn').addEventListener('click', async () => {
  const { error } = await client.auth.signOut();
  if (error) {
    alert(error.message);
  } else {
    window.location.href = 'https://diamondrolls.github.io/play/';
  }
});

// Redirect to login page if not logged in
client.auth.getSession().then(({ data }) => {
  if (!data.session) {
    window.location.href = 'https://diamondrolls.github.io/play/';
  }
});

// Load profile info (avatar + name)
async function loadProfile() {
  const { data: userData, error } = await client.auth.getUser();
  if (error || !userData.user) {
    console.log("Not logged in");
    return;
  }

  const user = userData.user;
  document.getElementById('userName').textContent = user.user_metadata?.name || "User";
  document.getElementById('displayName').value = user.user_metadata?.name || "";

  // Get public URL for the user's avatar
  const filePath = `${user.id}/avatar.png`;
  
  try {
    const { data } = client.storage.from('avatars').getPublicUrl(filePath);
    
    if (data && data.publicUrl) {
      // Check if the file actually exists by attempting to load it
      const img = new Image();
      img.onload = () => {
        document.getElementById('userAvatar').src = data.publicUrl;
      };
      img.onerror = () => {
        // Keep default avatar if file doesn't exist
        console.log("Avatar not found, using default");
      };
      img.src = data.publicUrl;
    }
  } catch (error) {
    console.log("Error loading avatar:", error.message);
  }
}

// Validate avatar file
function validateAvatarFile(file) {
  if (!file) {
    return { valid: false, message: "Please select a file" };
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, message: "Please upload an image file (JPEG, PNG, WebP, or GIF)" };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, message: `File size must be less than ${MAX_FILE_SIZE / (1024 * 1024)}MB` };
  }

  return { valid: true };
}

// Save profile with new avatar and display name
document.getElementById('saveProfileBtn').addEventListener('click', async () => {
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) {
    alert("You must be logged in to save profile");
    return;
  }

  const user = userData.user;
  const displayName = document.getElementById('displayName').value.trim();
  const avatarFile = document.getElementById('avatarUpload').files[0];

  if (!displayName) {
    alert("Please enter a display name");
    return;
  }

  // Validate avatar if provided
  if (avatarFile) {
    const validation = validateAvatarFile(avatarFile);
    if (!validation.valid) {
      alert(validation.message);
      return;
    }
  }

  setLoadingState(true);

  try {
    let avatarUrl = null;

    // Upload avatar if selected
    if (avatarFile) {
      const filePath = `${user.id}/avatar.png`;
      
      // Delete old avatar if exists
      try {
        await client.storage.from('avatars').remove([filePath]);
      } catch (error) {
        // Avatar may not exist, continue
        console.log("No previous avatar to delete");
      }
      
      // Upload new avatar
      const { data: uploadData, error: uploadError } = await client.storage
        .from('avatars')
        .upload(filePath, avatarFile, { upsert: true });

      if (uploadError) {
        alert("Error uploading avatar: " + uploadError.message);
        setLoadingState(false);
        return;
      }

      // Get public URL
      const { data: urlData } = client.storage.from('avatars').getPublicUrl(filePath);
      avatarUrl = urlData.publicUrl;
    }

    // Update user metadata with display name and avatar
    const updateData = {
      data: {
        name: displayName
      }
    };

    if (avatarUrl) {
      updateData.data.avatar = avatarUrl;
    }

    const { error: updateError } = await client.auth.updateUser(updateData);

    if (updateError) {
      alert("Error saving profile: " + updateError.message);
      setLoadingState(false);
      return;
    }

    alert("Profile saved successfully!");
    
    // Refresh profile display
    if (avatarUrl) {
      document.getElementById('userAvatar').src = avatarUrl;
    }
    document.getElementById('userName').textContent = displayName;
    document.getElementById('avatarUpload').value = ""; // Clear file input

  } catch (error) {
    alert("Error: " + error.message);
  } finally {
    setLoadingState(false);
  }
});

// Load profile on page load
loadProfile();

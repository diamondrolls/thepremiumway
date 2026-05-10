// Supabase Configuration
const supabaseUrl = 'https://fjtzodjudyctqacunlqp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqdHpvZGp1ZHljdHFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwNjA2OTQsImV4cCI6MjA3MzYzNjY5NH0.qR9RBsecfGUfKnbWgscmxloM-oEClJs_bo5YWoxFoE4';
const { createClient } = supabase;
const client = createClient(supabaseUrl, supabaseKey);

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
  const { data } = client.storage.from('avatars').getPublicUrl(filePath);

  if (data && data.publicUrl) {
    document.getElementById('userAvatar').src = data.publicUrl;
  }
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

  try {
    let avatarUrl = null;

    // Upload avatar if selected
    if (avatarFile) {
      const filePath = `${user.id}/avatar.png`;
      
      // Delete old avatar if exists
      await client.storage.from('avatars').remove([filePath]);
      
      // Upload new avatar
      const { data: uploadData, error: uploadError } = await client.storage
        .from('avatars')
        .upload(filePath, avatarFile, { upsert: true });

      if (uploadError) {
        alert("Error uploading avatar: " + uploadError.message);
        return;
      }

      // Get public URL
      const { data: urlData } = client.storage.from('avatars').getPublicUrl(filePath);
      avatarUrl = urlData.publicUrl;
    }

    // Update user metadata with display name and avatar
    const { error: updateError } = await client.auth.updateUser({
      data: {
        name: displayName,
        avatar: avatarUrl
      }
    });

    if (updateError) {
      alert("Error saving profile: " + updateError.message);
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
  }
});

// Load profile on page load
loadProfile();

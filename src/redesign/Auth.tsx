/** @jsxImportSource react */
import React, { useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, Image, Linking, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { applyActionCode, confirmPasswordReset, createUserWithEmailAndPassword, reload, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, updateProfile, verifyPasswordResetCode } from 'firebase/auth';
import { auth } from '../config/firebase';
import { Brand, Button, Divider, Field, Heading, Notice, Screen, T } from './ui';
import { colors, fonts } from './tokens';
import { authenticateGoogle, googleStatus } from './googleAuth';

type AuthPage = 'welcome' | 'login' | 'signup' | 'forgot' | 'verifyEmail' | 'verifyReset' | 'newPassword';
const authMessage = (err: unknown) => {
  const code = (err as {code?:string})?.code ?? '';
  const messages: Record<string,string> = {
    'auth/invalid-email':'Enter a valid email address.',
    'auth/invalid-credential':'Check your email and password and try again.',
    'auth/email-already-in-use':'This email already has an account. Sign in instead.',
    'auth/weak-password':'Use a stronger password.',
    'auth/password-does-not-meet-requirements':'Use a password that meets the app’s Firebase password policy.',
    'auth/user-disabled':'This account is disabled. Contact support.',
    'auth/operation-not-allowed':'This sign-in method is not enabled in Firebase.',
    'auth/network-request-failed':'Check your connection and try again.',
    'auth/too-many-requests':'Too many attempts. Please try again later.',
    'auth/invalid-action-code':'This email link is not valid. Request a new one.',
    'auth/expired-action-code':'This email link has expired. Request a new one.',
  };
  return messages[code] ?? 'The request could not be completed. Please try again.';
};
function GoogleButton({ onPress, busy }: { onPress: () => void; busy: boolean }) {
  const status = googleStatus();
  return <View>
    <Pressable accessibilityRole="button" accessibilityLabel="Continue with Google" accessibilityState={{ disabled: busy || !status.enabled }} disabled={busy || !status.enabled} onPress={onPress} style={[s.google, (busy || !status.enabled) && { opacity: .55 }]}>
      <Image source={require('../../assets/redesign/google-mark.png')} style={{width:25,height:25}} resizeMode="contain" accessible={false}/>
      <T style={{color:'#202124',fontSize:16}}>Continue with Google</T>
    </Pressable>
    {!status.enabled && <T style={s.setupHint}>{status.message}</T>}
  </View>;
}
export default function AuthFlow({ setRegistrationActive, onDone }: { setRegistrationActive: (active:boolean)=>void; onDone:()=>void }) {
  const [page,setPage] = useState<AuthPage>('welcome');
  const [email,setEmail] = useState('');
  const [name,setName] = useState('');
  const [password,setPassword] = useState('');
  const [confirm,setConfirm] = useState('');
  const [busy,setBusy] = useState(false);
  const pending = useRef(false);
  const [showPassword,setShowPassword] = useState(false);
  const [error,setError] = useState('');
  const [resetLink,setResetLink] = useState('');
  const [code,setCode] = useState('');
  const [resetEmail,setResetEmail] = useState('');
  const {width} = useWindowDimensions();
  const go = (next:AuthPage) => {setError('');setPage(next);};

  useEffect(() => {
    const sub=BackHandler.addEventListener('hardwareBackPress',()=>{
      if(busy) return true;
      if(page==='welcome') return false;
      if(page==='verifyEmail') {onDone();return true;}
      setError('');setPage(page==='login'||page==='signup' ? 'welcome':'login');return true;
    }); return ()=>sub.remove();
  },[page,busy,onDone]);

  useEffect(() => {
    let live = true;
    const receive = async (url:string|null) => {
      if(!url) return;
      try {
        const parsed = new URL(url);
        const action = parsed.searchParams.get('mode');
        const actionCode = parsed.searchParams.get('oobCode');
        if(!actionCode) return;
        if(action==='resetPassword') {
          const address = await verifyPasswordResetCode(auth, actionCode);
          if(live) {setCode(actionCode);setResetEmail(address);setPage('newPassword');setPassword('');setConfirm('');}
        } else if(action==='verifyEmail') {
          await applyActionCode(auth, actionCode);
          if(auth.currentUser) await reload(auth.currentUser);
          if(live) {Alert.alert('Email verified','You can now continue.');setPage('verifyEmail');}
        }
      } catch(err) {if(live) setError(authMessage(err));}
    };
    void Linking.getInitialURL().then(receive);
    const sub=Linking.addEventListener('url',e=>{void receive(e.url);});
    return ()=>{live=false;sub.remove();};
  },[]);

  const login = async () => {
    if(pending.current)return;
    if(!email.trim()||!password) {setError('Enter your email and password.');return;}
    pending.current=true;setBusy(true);setError('');
    try {await signInWithEmailAndPassword(auth,email.trim(),password);onDone();}
    catch(err){setError(authMessage(err));}finally{pending.current=false;setBusy(false);}
  };
  const register = async () => {
    if(pending.current)return;
    if(!name.trim()||!email.trim()||password.length<8) {setError('Enter your name, email, and a password with at least eight characters.');return;}
    if(password!==confirm){setError('The passwords do not match.');return;}
    pending.current=true;setBusy(true);setError('');setRegistrationActive(true);
    let created=false;
    try {
      const result=await createUserWithEmailAndPassword(auth,email.trim(),password);created=true;
      await updateProfile(result.user,{displayName:name.trim()});
      await sendEmailVerification(result.user);go('verifyEmail');
    } catch(err) {
      // Never retry account creation after Firebase already created the user.
      setError(created?'Your account was created, but profile/email setup did not finish. Use Resend email or update your name in Profile.':authMessage(err));
      if(created) setPage('verifyEmail'); else setRegistrationActive(false);
    } finally {pending.current=false;setBusy(false);}
  };
  const google = async () => {
    if(pending.current)return;
    pending.current=true;setBusy(true);setError('');
    try {if(await authenticateGoogle('signIn'))onDone();}
    catch(err){setError(err instanceof Error?err.message:'Google sign-in failed. Try again.');}
    finally{pending.current=false;setBusy(false);}
  };
  const forgot = async () => {
    if(!email.trim()){setError('Enter your email address.');return;}
    setBusy(true);setError('');
    try {await sendPasswordResetEmail(auth,email.trim());go('verifyReset');}
    catch(err){setError(authMessage(err));}finally{setBusy(false);}
  };
  const verify = async () => {
    if(!auth.currentUser){setError('Sign in to check verification.');return;}
    setBusy(true);setError('');
    try {await reload(auth.currentUser); if(auth.currentUser.emailVerified) onDone();else setError('Open the verification link in your email first, then check again.');}
    catch(err){setError(authMessage(err));}finally{setBusy(false);}
  };
  const resend = async () => {
    setBusy(true);setError('');
    try {if(page==='verifyEmail'&&auth.currentUser) await sendEmailVerification(auth.currentUser);else await sendPasswordResetEmail(auth,email.trim());Alert.alert('Email sent','Check your inbox and spam folder.');}
    catch(err){setError(authMessage(err));}finally{setBusy(false);}
  };
  const useResetLink = async () => {
    setBusy(true);setError('');
    try {
      const parsed = new URL(resetLink.trim());
      const actionCode = parsed.searchParams.get('oobCode');
      if(!actionCode||parsed.searchParams.get('mode')!=='resetPassword') throw new Error('bad-link');
      const address = await verifyPasswordResetCode(auth,actionCode);
      setCode(actionCode);setResetEmail(address);setPassword('');setConfirm('');go('newPassword');
    } catch {setError('Paste the complete, unexpired password-reset link from the Firebase email.');}
    finally{setBusy(false);}
  };
  const setNewPassword = async () => {
    if(!code){setError('A valid password-reset link is required.');return;}
    if(password.length<6||password!==confirm){setError('Passwords must match and contain at least six characters.');return;}
    setBusy(true);setError('');
    try {await confirmPasswordReset(auth,code,password);setCode('');setPassword('');setConfirm('');go('login');Alert.alert('Password updated','Sign in with your new password.');}
    catch(err){setError(authMessage(err));}finally{setBusy(false);}
  };
  const footer = (isLogin:boolean) => <View style={s.footer}><T style={s.footerPrompt}>{isLogin ? 'Don’t have an account?' : 'Do you have an account?'}</T><Pressable accessibilityRole="button" onPress={()=>go(isLogin?'signup':'login')} style={s.linkHit}><T style={s.link}>{isLogin?'register':'login'}</T></Pressable></View>;

  if(page==='welcome') return <Screen contentStyle={{justifyContent:'space-between'}}>
    <View style={{flex:1,minHeight:300,justifyContent:'center',alignItems:'center'}}><Brand size={145} wordmark/><T style={{fontSize:10,color:colors.muted,marginTop:20}}>manage your workouts</T></View>
    <View style={{gap:20,paddingBottom:42}}><Button title="Login" onPress={()=>go('login')}/><Button title="Sign-up" onPress={()=>go('signup')}/></View>
  </Screen>;

  if(page==='login'||page==='signup') return <Screen>
    {page==='signup' ? <Heading title="Create an Account" onBack={()=>go('welcome')}/> : null}
    <View style={{alignItems:'center',marginTop:page==='login'?28:8,marginBottom:page==='login'?40:34}}>
      {page==='login' ? <Image source={require('../../assets/redesign/phone-badge.png')} style={{width:70,height:70}}/> : <View style={s.profileBadge}><Ionicons name="person-outline" size={43} color={colors.white}/></View>}
      {page==='login' && <><T style={s.welcome}>WELCOME BACK</T><T style={s.subtitle}>manage your workouts</T></>}
    </View>
    <View style={{gap:18}}>
      {page==='signup' && <Field icon="person" accessibilityLabel="Username" placeholder="Username" value={name} onChangeText={setName} maxLength={50} autoCapitalize="words" editable={!busy}/>}
      <Field icon="person" accessibilityLabel="Email" placeholder="user@gmail.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" value={email} onChangeText={setEmail} editable={!busy}/>
      <Field icon="lock-closed" accessibilityLabel="Password" placeholder="password" secureTextEntry={!showPassword} value={password} onChangeText={setPassword} autoCapitalize="none" autoComplete={page==='login'?'current-password':'new-password'} editable={!busy}/>
      {page==='signup'&&<Field icon="lock-closed" accessibilityLabel="Confirm password" placeholder="Confirm password" secureTextEntry={!showPassword} value={confirm} onChangeText={setConfirm} autoCapitalize="none" autoComplete="new-password" editable={!busy}/>}
      <Pressable accessibilityRole="button" onPress={()=>setShowPassword(v=>!v)} style={s.linkHit}><T style={s.smallLink}>{showPassword?'Hide password':'Show password'}</T></Pressable>
      {page==='signup'&&<T style={s.explanation}>Use at least eight characters. We will email a verification link. Google sign-in does not need a separate password.</T>}

    </View>
    {page==='login' && <Pressable onPress={()=>go('forgot')} accessibilityRole="button" style={[s.linkHit,{alignSelf:'flex-end',marginTop:18}]}><T style={s.link}>forgot password?</T></Pressable>}
    {error ? <Notice message={error}/> : null}
    <Button title={page==='login'?'Sign In':'Register'} onPress={page==='login'?login:register} loading={busy} style={{marginTop:page==='login'?20:34}}/>
    <Divider/><GoogleButton onPress={()=>{void google();}} busy={busy}/>{footer(page==='login')}
  </Screen>;

  if(page==='forgot') return <Screen>
    <Heading title="" onBack={()=>go('login')}/>
    <View style={{marginTop:95}}><T style={s.label}>Enter your Email</T><Field icon="person" accessibilityLabel="Email" placeholder="user@gmail.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false}/><Pressable style={s.linkHit} onPress={()=>go('login')}><T style={s.smallLink}>Back to sign-in</T></Pressable></View>
    {error ? <Notice message={error}/> : null}<Button title="Send" loading={busy} onPress={forgot} style={{marginTop:38}}/>
    <Divider label="or"/><GoogleButton onPress={()=>{void google();}} busy={busy}/><View style={{flex:1,minHeight:45}}/>{footer(true)}
  </Screen>;

  if(page==='verifyEmail'||page==='verifyReset') return <Screen>
    <Heading title="Verification" onBack={()=>page==='verifyEmail'?onDone():go('forgot')}/>
    <View style={{marginTop:88}}><T style={s.label}>Check your email</T>
      <View style={s.verifyIcons}>{(['mail-outline','open-outline','checkmark','refresh'] as const).map((icon,i)=><View key={icon} style={{width:Math.min((width-112)/4,57),height:Math.min((width-112)/4,57),borderRadius:50,backgroundColor:'white',alignItems:'center',justifyContent:'center'}}><Ionicons name={icon} size={25} color={i===2?colors.green:'#74747D'}/></View>)}</View>
      <T style={s.explanation}>{page==='verifyEmail'?'Use the verification link sent to your email.':'If this address has an account, a password-reset email has been sent. Open its link to continue.'}</T>
      <Pressable onPress={resend} disabled={busy} style={s.linkHit}><T style={s.smallLink}>Didn’t receive it? <T style={{fontSize:10,color:colors.green}}>Resend email</T></T></Pressable>
    </View>
    {error ? <Notice message={error}/> : null}
    {page==='verifyEmail' ? <><Button title="Check verification" loading={busy} onPress={verify} style={{marginTop:30}}/><Pressable onPress={onDone} style={s.linkHit}><T style={s.smallLink}>Continue to app</T></Pressable></> : <View style={{marginTop:24,gap:14}}>
      <T style={s.explanation}>Alternatively, paste the complete reset link below. Firebase verifies the link before opening New Password.</T>
      <Field accessibilityLabel="Password reset link" placeholder="Paste reset email link" autoCapitalize="none" autoCorrect={false} value={resetLink} onChangeText={setResetLink}/>
      <Button title="Verify link" loading={busy} onPress={useResetLink}/>
    </View>}
  </Screen>;

  return <Screen><Heading title="New Password" onBack={()=>go('forgot')}/><View style={{marginTop:88,gap:14}}>
    {resetEmail ? <T style={s.explanation}>{resetEmail}</T> : null}
    <T style={s.label}>Enter new password</T><Field icon="lock-closed" accessibilityLabel="New password" secureTextEntry placeholder="new password" value={password} onChangeText={setPassword} autoComplete="new-password"/>
    <T style={s.label}>Confirm Password</T><Field icon="lock-closed" accessibilityLabel="Confirm new password" secureTextEntry placeholder="Confirm password" value={confirm} onChangeText={setConfirm}/>
    {error ? <Notice message={error}/> : null}<Button title="Submit" loading={busy} onPress={setNewPassword}/>
  </View></Screen>;
}
const s=StyleSheet.create({
  welcome:{fontFamily:fonts.heading,fontSize:26,marginTop:38,textAlign:'center'},subtitle:{fontSize:11,color:colors.muted,marginTop:8},
  profileBadge:{width:90,height:90,borderRadius:45,backgroundColor:colors.greenDark,borderWidth:2,borderColor:colors.green,alignItems:'center',justifyContent:'center'},
  google:{minHeight:46,borderRadius:18,backgroundColor:'white',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:14},
  setupHint:{fontSize:9,color:colors.faint,textAlign:'center',marginTop:7},footer:{alignItems:'center',marginTop:24},footerPrompt:{fontSize:12,color:colors.muted},
  linkHit:{minHeight:44,justifyContent:'center',alignItems:'center',paddingHorizontal:8},link:{fontSize:12},smallLink:{fontSize:10,color:colors.muted,textAlign:'center'},
  label:{fontSize:12,textAlign:'center',marginBottom:12},explanation:{fontSize:11,color:colors.muted,textAlign:'center',lineHeight:18},
  verifyIcons:{flexDirection:'row',justifyContent:'space-between',marginVertical:12},
});

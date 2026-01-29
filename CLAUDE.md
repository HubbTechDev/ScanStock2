<stack>
  Expo SDK 53, React Native 0.76.7, bun (not npm).
  React Query for server/async state.
  NativeWind + Tailwind v3 for styling.
  react-native-reanimated v3 for animations (preferred over Animated from react-native).
  react-native-gesture-handler for gestures.
  lucide-react-native for icons.
  All packages are pre-installed. DO NOT install new packages unless they are @expo-google-font packages or pure JavaScript helpers like lodash, dayjs, etc.
</stack>

<structure>
  src/app/          — Expo Router file-based routes (src/app/_layout.tsx is root). Add new screens to this folder.
  src/components/   — Reusable UI components. Add new components to this folder.
  src/lib/          — Utilities: cn.ts (className merge), example-context.ts (state pattern)
</structure>

<typescript>
  Explicit type annotations for useState: `useState<Type[]>([])` not `useState([])`
  Null/undefined handling: use optional chaining `?.` and nullish coalescing `??`
  Include ALL required properties when creating objects — TypeScript strict mode is enabled.
</typescript>

<environment>
  You are in Vibecode. The system manages git and the dev server (port 8081).
  DO NOT: manage git, touch the dev server, or check its state.
  The user views the app through Vibecode App.
  The user cannot see the code or interact with the terminal. Do not tell the user to do anything with the code or terminal.
  You can see logs in the expo.log file.
  The Vibecode App has tabs like ENV tab, API tab, LOGS tab. You can ask the user to use these tabs to view the logs, add enviroment variables, or give instructions for APIs like OpenAI, Nanobanana, Grok, Elevenlabs, etc. but first try to implement the functionality yourself.
  The user is likely non-technical, communicate with them in an easy to understand manner.
  If the user's request is vague or ambitious, scope down to specific functionality. Do everything for them.
  For images, use URLs from unsplash.com. You can also tell the user they can use the IMAGES tab to generate and uplooad images.
</environment>


<forbidden_files>
  Do not edit: patches/, babel.config.js, metro.config.js, app.json, tsconfig.json, nativewind-env.d.ts
</forbidden_files>

<routing>
  Expo Router for file-based routing. Every file in src/app/ becomes a route.
  Never delete or refactor RootLayoutNav from src/app/_layout.tsx.
  
  <stack_router>
    src/app/_layout.tsx (root layout), src/app/index.tsx (matches '/'), src/app/settings.tsx (matches '/settings')
    Use <Stack.Screen options={{ title, headerStyle, ... }} /> inside pages to customize headers.
  </stack_router>
  
  <tabs_router>
    Only files registered in src/app/(tabs)/_layout.tsx become actual tabs.
    Unregistered files in (tabs)/ are routes within tabs, not separate tabs.
    Nested stacks create double headers — remove header from tabs, add stack inside each tab.
    At least 2 tabs or don't use tabs at all — single tab looks bad.
  </tabs_router>
  
  <router_selection>
    Games should avoid tabs — use full-screen stacks instead.
    For full-screen overlays/modals outside tabs: create route in src/app/ (not src/app/(tabs)/), 
    then add `<Stack.Screen name="page" options={{ presentation: "modal" }} />` in src/app/_layout.tsx.
  </router_selection>
  
  <rules>
    Only ONE route can map to "/" — can't have both src/app/index.tsx and src/app/(tabs)/index.tsx.
    Dynamic params: use `const { id } = useLocalSearchParams()` from expo-router.
  </rules>
</routing>

<state>
  React Query for server/async state. Always use object API: `useQuery({ queryKey, queryFn })`.
  Never wrap RootLayoutNav directly.
  React Query provider must be outermost; nest other providers inside it.
  
  Use `useMutation` for async operations — no manual `setIsLoading` patterns.
  Wrap third-party lib calls (RevenueCat, etc.) in useQuery/useMutation for consistent loading states.
  Reuse query keys across components to share cached data — don't create duplicate providers.
  
  For local state, use Zustand. However, most state is server state, so use React Query for that.
  Always use a selector with Zustand to subscribe only to the specific slice of state you need (e.g., useStore(s => s.foo)) rather than the whole store to prevent unnecessary re-renders. Make sure that the value returned by the selector is a primitive. Do not execute store methods in selectors; select data/functions, then compute outside the selector.
  For persistence: use AsyncStorage inside context hook providers. Only persist necessary data.
  Split ephemeral from persisted state to avoid hydration bugs.
</state>

<safearea>
  Import from react-native-safe-area-context, NOT from react-native.
  Skip SafeAreaView inside tab stacks with navigation headers.
  Skip when using native headers from Stack/Tab navigator.
  Add when using custom/hidden headers.
  For games: use useSafeAreaInsets hook instead.
</safearea>

<data>
  Create realistic mock data when you lack access to real data.
  For image analysis: actually send to LLM don't mock.
</data>

<design>
  Don't hold back. This is mobile — design for touch, thumb zones, glanceability.
  Inspiration: iOS, Instagram, Airbnb, Coinbase, polished habit trackers.

  <avoid>
    Purple gradients on white, generic centered layouts, predictable patterns.
    Web-like designs on mobile. Overused fonts (Space Grotesk, Inter).
  </avoid>

  <do>
    Cohesive themes with dominant colors and sharp accents.
    High-impact animations: progress bars, button feedback, haptics.
    Depth via gradients and patterns, not flat solids.
    Install `@expo-google-fonts/{font-name}` for fonts (eg: `@expo-google-fonts/inter`)
    Use zeego for context menus and dropdowns (native feel). Lookup the documentation on zeego.dev to see how to use it.
  </do>
</design>

<mistakes>
  <styling>
    Use Nativewind for styling. Use cn() helper from src/lib/cn.ts to merge classNames when conditionally applying classNames or passing classNames via props.
    CameraView, LinearGradient, and Animated components DO NOT support className. Use inline style prop.
    Horizontal ScrollViews will expand vertically to fill flex containers. Add `style={{ flexGrow: 0 }}` to constrain height to content.
  </styling>

  <camera>
    Use CameraView from expo-camera, NOT the deprecated Camera import.
    import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
    Use style={{ flex: 1 }}, not className.
    Overlay UI must be absolute positioned inside CameraView.
  </camera>

  <react_native>
    No Node.js buffer in React Native — don't import from 'buffer'.
  </react_native>

  <ux>
    Use Pressable over TouchableOpacity.
    Use custom modals, not Alert.alert().
    Ensure keyboard is dismissable and doesn't obscure inputs. This is much harder to implement than it seems. You can use the react-native-keyboard-controller package to help with this. But, make sure to look up the documentation before implementing.
  </ux>

  <outdated_knowledge>
    Your react-native-reanimated and react-native-gesture-handler training may be outdated. Look up current docs before implementing.
  </outdated_knowledge>
</mistakes>

<appstore>
  Cannot assist with App Store or Google Play submission processes (app.json, eas.json, EAS CLI commands).
  For submission help, click "Share" on the top right corner on the Vibecode App and select "Submit to App Store".
</appstore> 

<vibecode_cloud>
- The backend, database, and authentication features are called Vibecode Cloud collectively.
- Not all apps will have cloud enabled, but if they do, the backend server is in the "/home/user/workspace/backend" directory. 
- The backend is a TypeScript + Bun backend powered by a simple Hono server, Prisma ORM with SQLite database, and Better Auth authentication. If you are unaware of any packages or libraries, feel free to look up their documentation. 
- Just like the frontend Expo server, the dev backend server for this backend is automatically running on port 3000. DO NOT attempt to run it manually.
- Since the Expo frontend app is technically running on the user's phone even though it is bundled and served through a VM, we have created a reverse proxy that replaced the BACKEND_URL and EXPO_PUBLIC_VIBECODE_BACKEND_URL enviroment variables with the actual backend server URL. You can run "env" using bash to view the actual backend server URL. The backend URL looks something like https://[UNIQUE_ID].share.sandbox.dev/
- IMPORTANT: Since both the backend and frontend servers are running automatically, DO NOT run "bun start" or "bunx expo start" like that. Just ask the user to refresh the app on the Vibecode app if they do not see the changes.
- Not all apps will have a database, but if they do, when you update the DB, make sure to create a migration file using "bunx prisma migrate dev --create-only --name <migration-name>" and then run "bunx prisma migrate deploy" to apply the migrations to the database. This will push changes to the database and generate a new typesafe Prisma client that will automatically be consumed by the "server/src/db.ts" file that instantiates the Prisma DB client
- Unlike the frontend which comes pre-bundled with native code, the backend is pure JavaScript and only runs in the sandbox, so you may install any packages in the "/home/user/workspace/backend" directory.
- You can read the backend logs by reading the "/home/user/workspace/backend/server.log" file. The user cannot read these logs. These can be very helpful when debugging runtime issues.
- All routes in the backend are defined in the "/home/user/workspace/backend/src/routes" directory.
- Use `import { type AppType } from "./types";` for context access for all new routers.
- Whenever you create a new route, add the types for the request and response to the "/home/user/workspace/shared/contracts.ts" using zod schemas, and then infer the types from the schemas. You can use the zod schema to validate the request in the backend, and you can use the types in the frontend. This makes sure the types are shared between the backend and frontend.
- Use the API client at src/lib/api.ts for all backend requests from the frontend.
</vibecode_cloud>

<skills>
You have access to a few skills in the `.claude/skills` folder. Use them to your advantage.
- ai-apis-like-chatgpt: Use this skill when the user asks you to make an app that requires an AI API.
- expo-docs: Use this skill when the user asks you to use an Expo SDK module or package that you might not know much about.
- frontend-app-design: Use this skill when the user asks you to design a frontend app component or screen.
</skills>
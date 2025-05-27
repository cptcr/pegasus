PS C:\Users\toowa\OneDrive\Desktop\Hinko> npx eslint . --ext .ts,.tsx

C:\Users\toowa\OneDrive\Desktop\Hinko\dashboard\components\EventNotifications.tsx
   80:9  error  Unexpected lexical declaration in case block  no-case-declarations
   83:9  error  Unexpected lexical declaration in case block  no-case-declarations
   86:9  error  Unexpected lexical declaration in case block  no-case-declarations
   89:9  error  Unexpected lexical declaration in case block  no-case-declarations
   92:9  error  Unexpected lexical declaration in case block  no-case-declarations
   95:9  error  Unexpected lexical declaration in case block  no-case-declarations
   98:9  error  Unexpected lexical declaration in case block  no-case-declarations
  101:9  error  Unexpected lexical declaration in case block  no-case-declarations

C:\Users\toowa\OneDrive\Desktop\Hinko\dashboard\components\ThemeToggle.tsx
  12:11  error  'theme' is assigned a value but never used  @typescript-eslint/no-unused-vars

C:\Users\toowa\OneDrive\Desktop\Hinko\dashboard\lib\database.ts
  29:11  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

C:\Users\toowa\OneDrive\Desktop\Hinko\dashboard\lib\discordService.ts
  2:68  error  'GuildChannel' is defined but never used        @typescript-eslint/no-unused-vars
  3:31  error  'GuildWithFullStats' is defined but never used  @typescript-eslint/no-unused-vars

C:\Users\toowa\OneDrive\Desktop\Hinko\dashboard\lib\websocket.ts
    7:18  error  An interface declaring no members is equivalent to its supertype  @typescript-eslint/no-empty-object-type
  254:17  error  'typedData' is assigned a value but never used                    @typescript-eslint/no-unused-vars

C:\Users\toowa\OneDrive\Desktop\Hinko\dashboard\pages\api\dashboard\guild\[id].ts
  4:28  error  'prisma' is defined but never used  @typescript-eslint/no-unused-vars

C:\Users\toowa\OneDrive\Desktop\Hinko\dashboard\pages\api\dashboard\settings.ts
    4:41  error  Unexpected any. Specify a different type              @typescript-eslint/no-explicit-any
   64:57  error  Unexpected any. Specify a different type              @typescript-eslint/no-explicit-any
   71:7   error  'ALLOWED_USER_ID' is assigned a value but never used  @typescript-eslint/no-unused-vars
   72:7   error  'TARGET_GUILD_ID' is assigned a value but never used  @typescript-eslint/no-unused-vars
   74:28  error  'req' is defined but never used                       @typescript-eslint/no-unused-vars
  138:37  error  Unexpected any. Specify a different type              @typescript-eslint/no-explicit-any
  138:43  error  Unexpected any. Specify a different type              @typescript-eslint/no-explicit-any
  158:24  error  Unexpected any. Specify a different type              @typescript-eslint/no-explicit-any

C:\Users\toowa\OneDrive\Desktop\Hinko\dashboard\pages\settings.tsx
  12:3   error  'ShieldCheckIcon' is defined but never used        @typescript-eslint/no-unused-vars
  61:9   error  'router' is assigned a value but never used        @typescript-eslint/no-unused-vars
  65:21  error  'setPageError' is assigned a value but never used  @typescript-eslint/no-unused-vars

C:\Users\toowa\OneDrive\Desktop\Hinko\dashboard\types\index.ts
   5:3    error  'Collection' is defined but never used            @typescript-eslint/no-unused-vars
  10:302  error  'PrismaTicketCategory' is defined but never used  @typescript-eslint/no-unused-vars
  10:481  error  'PrismaCustomCommand' is defined but never used   @typescript-eslint/no-unused-vars

C:\Users\toowa\OneDrive\Desktop\Hinko\src\commands\general\help.ts
  59:73  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  59:91  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

C:\Users\toowa\OneDrive\Desktop\Hinko\src\commands\general\ping.ts
  19:11  error  'startTime' is assigned a value but never used  @typescript-eslint/no-unused-vars

C:\Users\toowa\OneDrive\Desktop\Hinko\src\commands\giveaway\giveaway.ts
  202:54  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  224:58  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

C:\Users\toowa\OneDrive\Desktop\Hinko\src\events\interactionCreate.ts
  3:10  error  'ExtendedClient' is defined but never used  @typescript-eslint/no-unused-vars

C:\Users\toowa\OneDrive\Desktop\Hinko\src\handlers\CommandHandler.ts
  5:10  error  'fileURLToPath' is defined but never used  @typescript-eslint/no-unused-vars

C:\Users\toowa\OneDrive\Desktop\Hinko\src\modules\giveaways\GiveawayManager.ts
  127:41  error  'moderatorId' is defined but never used  @typescript-eslint/no-unused-vars

C:\Users\toowa\OneDrive\Desktop\Hinko\src\modules\polls\PollManager.ts
  674:19  error  'pollId' is assigned a value but never used  @typescript-eslint/no-unused-vars

C:\Users\toowa\OneDrive\Desktop\Hinko\src\modules\quarantine\QuarantineManager.ts
   16:3   error  'ButtonInteraction' is defined but never used        @typescript-eslint/no-unused-vars
  197:13  error  'quarantineRole' is assigned a value but never used  @typescript-eslint/no-unused-vars
  517:19  error  'entryId' is assigned a value but never used         @typescript-eslint/no-unused-vars

C:\Users\toowa\OneDrive\Desktop\Hinko\src\modules\tickets\TicketManager.ts
   11:3   error  'OverwriteResolvable' is defined but never used  @typescript-eslint/no-unused-vars
   12:3   error  'User' is defined but never used                 @typescript-eslint/no-unused-vars
   13:3   error  'GuildMember' is defined but never used          @typescript-eslint/no-unused-vars
   15:3   error  'ButtonInteraction' is defined but never used    @typescript-eslint/no-unused-vars
  631:12  error  Unexpected constant condition                    no-constant-condition

C:\Users\toowa\OneDrive\Desktop\Hinko\types\index.ts
  7:0  error  Parsing error: Merge conflict marker encountered

✖ 47 problems (47 errors, 0 warnings)

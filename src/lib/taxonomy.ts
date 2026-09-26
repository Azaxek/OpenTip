export type OrgType = 'crime_stoppers' | 'campus';

type Canned = { title: string; body: string; categories?: string[] };
type Cat = { name: string; description: string; highRisk?: boolean; teams?: string[] };

// Defaults only. Everything here is copied into the org's own editable rows at setup time.
const NOTE = 'A reviewer will reply here if they need more information, and it may take a while: this is not monitored in real time. Check back later, or turn on notifications below. If someone is in danger right now, call 911.';

export const TAXONOMIES: Record<OrgType, { categories: Cat[]; teams: string[]; canned: Canned[]; tipsterNote: string; helpText: string }> = {
  crime_stoppers: {
    tipsterNote: NOTE,
    helpText: 'Were you or someone you know a victim of a crime? Ask your local victim assistance program for free support. If you are in danger right now, call 911.',
    teams: ['Tip Coordinators'],
    canned: [
      { title: 'Thanks - we are looking into this', body: 'Thank you for reaching out. A reviewer is looking into this now. If you can share more detail (who, what, where, when), reply here. You stay anonymous.' },
      { title: 'Need more detail', body: 'Thanks for your tip. Can you tell us more about where and when this happened, and anything that would help us identify the people involved? Reply here. You stay anonymous.' },
    ],
    categories: [
      { name: 'Theft/Burglary', description: 'Stolen property, break-ins, shoplifting, or vehicle theft.' },
      { name: 'Robbery', description: 'Taking property from a person by force or threat.' },
      { name: 'Assault', description: 'Someone was physically attacked or threatened with harm.', highRisk: true },
      { name: 'Homicide', description: 'A killing, or information about one.', highRisk: true },
      { name: 'Drugs/Narcotics', description: 'Selling, making, or trafficking illegal drugs.' },
      { name: 'Weapons', description: 'Someone has, sells, or is planning to use a weapon illegally.', highRisk: true },
      { name: 'Wanted Person/Fugitive', description: 'You know where a wanted person is.' },
      { name: 'Vandalism', description: 'Property damaged, tagged, or destroyed.' },
      { name: 'Fraud', description: 'Scams, identity theft, forged documents, or financial crimes.' },
      { name: 'Gang Activity', description: 'Gang recruitment, violence, or crime by an organized group.' },
      { name: 'Other', description: 'Anything else you think police should know about.' },
    ],
  },
  campus: {
    tipsterNote: NOTE,
    helpText: 'If you or someone you know is thinking about suicide or is in emotional distress, help is available any time: call or text 988 (Suicide & Crisis Lifeline, US), or text HOME to 741741 (Crisis Text Line). If someone is in immediate danger, call 911. Your organization can replace this with local resources.',
    teams: ['Administration', 'Counseling', 'School Resource Officer'],
    canned: [
      { title: 'Thanks - we are looking into this', body: 'Thank you for reaching out. A reviewer is looking into this now. If you can share more detail (who, what, where, when), reply here. You stay anonymous.' },
      { title: 'Crisis resources (US)', categories: ['Self-Harm/Suicide Concern', 'Mental Health/Wellness Concern'], body: 'If you or someone you know is thinking about suicide or is in emotional distress, help is available any time: call or text 988 (Suicide & Crisis Lifeline), or text HOME to 741741 (Crisis Text Line). If someone is in immediate danger, call 911. Replace this list with your local resources in Settings.' },
      { title: 'Abuse reporting resources (US)', categories: ['Abuse (physical, sexual, neglect)', 'Dating/Domestic Violence'], body: 'If a child or student is being hurt, call the Childhelp National Child Abuse Hotline at 1-800-422-4453, or 911 if someone is in immediate danger. For dating or domestic violence, the National Domestic Violence Hotline is 1-800-799-7233 (text START to 88788). Replace this list with your local resources in Settings.' },
    ],
    categories: [
      { name: 'Bullying/Cyberbullying', description: 'Repeated hurtful behavior toward someone, in person or online.', teams: ['Counseling'] },
      { name: 'Fighting/Threats of Violence', description: 'A fight, or someone threatening to hurt others.', highRisk: true, teams: ['School Resource Officer'] },
      { name: 'Weapons', description: 'Someone has or is planning to bring a weapon onto campus or into the community.', highRisk: true, teams: ['School Resource Officer'] },
      { name: 'Drugs/Alcohol', description: 'Using, selling, or bringing drugs or alcohol to school.', teams: ['School Resource Officer'] },
      { name: 'Self-Harm/Suicide Concern', description: 'Someone may hurt themselves or has talked about suicide.', highRisk: true, teams: ['Counseling'] },
      { name: 'Abuse (physical, sexual, neglect)', description: 'A child or student is being hurt or is not being cared for.', highRisk: true, teams: ['Counseling', 'School Resource Officer'] },
      { name: 'Dating/Domestic Violence', description: 'Violence, control, or threats in a relationship or at home.', highRisk: true, teams: ['Counseling'] },
      { name: 'Theft', description: 'Stolen belongings or school property.', teams: ['School Resource Officer'] },
      { name: 'Vandalism', description: 'Damage to school property or belongings.', teams: ['School Resource Officer'] },
      { name: 'Mental Health/Wellness Concern', description: 'Someone seems to be struggling and could use support.', teams: ['Counseling'] },
      { name: 'Other', description: 'Anything else the school should know about.' },
    ],
  },
};

/** Team that receives every tip regardless of category (first team listed). */
export const catchAllTeam = (t: OrgType) => TAXONOMIES[t].teams[0];

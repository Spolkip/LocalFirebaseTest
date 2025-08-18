export const parseBBCode = (text) => {
    if (!text) return '';

    let html = text;

    // #comment escape HTML to prevent XSS
    html = html.replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // #comment convert newlines to <br> tags
    html = html.replace(/\n/g, '<br />');

    // [b]bold[/b]
    html = html.replace(/\[b\](.*?)\[\/b\]/gs, '<strong>$1</strong>');

    // [i]italic[/i]
    html = html.replace(/\[i\](.*?)\[\/i\]/gs, '<em>$1</em>');

    // [u]underline[/u]
    html = html.replace(/\[u\](.*?)\[\/u\]/gs, '<u>$1</u>');

    // [color=red]red text[/color]
    html = html.replace(/\[color=(.*?)\](.*?)\[\/color\]/gs, '<span style="color: $1;">$2</span>');

    // [size=18]sized text[/size]
    html = html.replace(/\[size=(.*?)\](.*?)\[\/size\]/gs, '<span style="font-size: $1px;">$2</span>');

    // [quote]quoted text[/quote]
    html = html.replace(/\[quote\](.*?)\[\/quote\]/gs, '<blockquote class="bbcode-quote">$1</blockquote>');

    // [spoiler]spoiler text[/spoiler]
    html = html.replace(/\[spoiler\](.*?)\[\/spoiler\]/gs, '<details><summary>Spoiler</summary>$1</details>');

    // [img]image url[/img]
    html = html.replace(/\[img\](.*?)\[\/img\]/gs, '<img src="$1" alt="User Image" style="max-width: 100%;" />');

    // [url]url[/url] or [url=url]text[/url]
    html = html.replace(/\[url\](.*?)\[\/url\]/gs, '<a href="$1" target="_blank">$1</a>');
    html = html.replace(/\[url=(.*?)\](.*?)\[\/url\]/gs, '<a href="$1" target="_blank">$2</a>');

    // [action=type,id=someId]Click Me[/action]
    html = html.replace(/\[action=([^,\]]+),allianceId=([^\]]+)\](.*?)\[\/action\]/gs, (match, type, id, text) => {
        return `<span class="bbcode-action" data-action-type="${type}" data-action-id="${id}">${text}</span>`;
    });

    // [report]reportId[/report] - This will now be a placeholder for React to render the component
    html = html.replace(/\[report\](.*?)\[\/report\]/gs, '<div class="shared-report-placeholder" data-report-id="$1"></div>');

    // #comment New BBCode formats for reports
    // [player id=userId]Player Name[/player]
    html = html.replace(/\[player id=([^\]]+)\](.*?)\[\/player\]/gs, '<span class="bbcode-action" data-action-type="profile" data-action-id="$1">$2</span>');

    // [alliance id=allianceId]Alliance Name[/alliance]
    html = html.replace(/\[alliance id=([^\]]+)\](.*?)\[\/alliance\]/gs, '<span class="bbcode-action" data-action-type="alliance_profile" data-action-id="$1">$2</span>');

    // [city id=cityId owner=ownerId x=x y=y]City Name[/city]
    html = html.replace(/\[city id=([^ ]+) owner=([^ ]+) x=([\d.]+) y=([\d.]+)\](.*?)\[\/city\]/gs, '<span class="bbcode-action" data-action-type="city_link" data-action-id="$1" data-action-owner-id="$2" data-action-coords-x="$3" data-action-coords-y="$4">$5</span>');

    // [attack attacker="Player A" attacker_city="City A" defender="Player B" defender_city="City B"]...[/attack]
    html = html.replace(/\[attack attacker="([^"]*)" attacker_city="([^"]*)" defender="([^"]*)" defender_city="([^"]*)"\]/gs, '<b>Attack Report</b><br/>Attacker: $1 ($2)<br/>Defender: $3 ($4)');

    // [trade from_player="Player A" from_city="CityA" to_player="Player B" to_city="CityB"]...[/trade]
    html = html.replace(/\[trade from_player="([^"]*)" from_city="([^"]*)" to_player="([^"]*)" to_city="([^"]*)"\]/gs, '<b>Trade Report</b><br/>From: $1 ($2)<br/>To: $3 ($4)');

    // [scout attacker="Player A" attacker_city="City A" attacker_alliance="AllyA" defender="Player B" defender_city="City B" defender_alliance="AllyB"]...[/scout]
    html = html.replace(/\[scout attacker="([^"]*)" attacker_city="([^"]*)" attacker_alliance="([^"]*)" defender="([^"]*)" defender_city="([^"]*)" defender_alliance="([^"]*)"\]/gs, '<b>Scout Report</b><br/>Scout from: $1 ($2) [$3]<br/>Scouted: $4 ($5) [$6]');


    return html;
};

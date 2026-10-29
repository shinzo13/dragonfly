const SIDEBAR_KEY = "ffui.sidebar.collapsed";
const NOTES_KEY = "ffui.notes.shown";

function stored(key: string): boolean {
  return (
    typeof localStorage !== "undefined" && localStorage.getItem(key) === "1"
  );
}

class Ui {
  palette = $state(false);
  paletteQuery = $state("");
  quickEntry = $state(false);
  periodOpen = $state(false);
  mobileNav = $state(false);
  collapsed = $state(stored(SIDEBAR_KEY));
  notes = $state(stored(NOTES_KEY));

  toggleNotes() {
    this.notes = !this.notes;
    localStorage.setItem(NOTES_KEY, this.notes ? "1" : "0");
  }

  openPalette(query = "") {
    this.paletteQuery = query;
    this.palette = true;
  }

  toggleSidebar() {
    if (window.matchMedia("(max-width: 1023px)").matches) {
      this.mobileNav = !this.mobileNav;
      return;
    }
    this.collapsed = !this.collapsed;
    localStorage.setItem(SIDEBAR_KEY, this.collapsed ? "1" : "0");
  }
}

export const ui = new Ui();
